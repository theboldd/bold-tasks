// Eventos do Google Agenda (link secreto iCal) das integrantes do workspace e da agenda da agência, no intervalo pedido.
// Os links nunca vão para o navegador; a busca é feita no servidor, com cache de 15 minutos.
// O Google limita (429) a infraestrutura do Supabase, então a busca passa pelo /api/ics do BOLD TASKS (Vercel).
import { createClient } from 'npm:@supabase/supabase-js@2'
import ICAL from 'npm:ical.js@2.1.0'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
const TTL_MS = 15 * 60 * 1000
const PROXY = 'https://bold-tasks-umber.vercel.app/api/ics'

type Ev = { owner_id: string | null; source: 'personal' | 'agency'; title: string; location: string | null; start: string; end: string; all_day: boolean; busy_only: boolean }
type Raw = { title: string; location: string | null; start: Date; end: Date; allDay: boolean }

async function fetchIcs(url: string, proxySecret?: string): Promise<string> {
  const https = url.replace(/^webcal:/, 'https:')
  let lastStatus = 0
  if (proxySecret) {
    try {
      const r = await fetch(PROXY, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-proxy-secret': proxySecret }, body: JSON.stringify({ url: https }) })
      if (r.ok) return await r.text()
      lastStatus = r.status
    } catch { /* tenta direto */ }
  }
  const r = await fetch(https, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BOLD-TASKS/1.0)' } })
  if (!r.ok) throw new Error(`O Google respondeu ${r.status}${lastStatus ? ` (via proxy: ${lastStatus})` : ''}`)
  return await r.text()
}

function expand(ics: string, from: Date, to: Date): Raw[] {
  const comp = new ICAL.Component(ICAL.parse(ics))
  for (const tz of comp.getAllSubcomponents('vtimezone')) {
    try { ICAL.TimezoneService.register(new ICAL.Timezone(tz)) } catch { /* já registrado */ }
  }
  const masters = new Map<string, InstanceType<typeof ICAL.Event>>()
  const exceptions: InstanceType<typeof ICAL.Event>[] = []
  for (const v of comp.getAllSubcomponents('vevent')) {
    const e = new ICAL.Event(v)
    if (v.getFirstPropertyValue('status') === 'CANCELLED' && !e.isRecurrenceException()) continue
    if (e.isRecurrenceException()) exceptions.push(e); else masters.set(e.uid + '|' + (e.startDate?.toString() ?? ''), e)
  }
  const byUid = new Map<string, InstanceType<typeof ICAL.Event>>()
  for (const m of masters.values()) if (m.isRecurring()) byUid.set(m.uid, m)
  for (const ex of exceptions) { const m = byUid.get(ex.uid); if (m) { try { m.relateException(ex) } catch { /* ignora */ } } }

  const out: Raw[] = []
  for (const e of masters.values()) {
    if (!e.startDate) continue
    const allDay = e.startDate.isDate
    if (!e.isRecurring()) {
      const s = e.startDate.toJSDate(), en = (e.endDate ?? e.startDate).toJSDate()
      if (en > from && s < to) out.push({ title: e.summary || '(sem título)', location: e.location || null, start: s, end: en, allDay })
      continue
    }
    const it = e.iterator()
    let next, guard = 0
    while ((next = it.next()) && guard++ < 2000) {
      const d = e.getOccurrenceDetails(next)
      const s = d.startDate.toJSDate(), en = d.endDate.toJSDate()
      if (s >= to) break
      if (en > from) {
        const status = d.item.component.getFirstPropertyValue('status')
        if (status !== 'CANCELLED') out.push({ title: d.item.summary || '(sem título)', location: d.item.location || null, start: s, end: en, allDay })
      }
    }
  }
  return out
}

// datas de dia inteiro: manter AAAA-MM-DD (sem fuso)
const isoDay = (d: Date) => d.toISOString().slice(0, 10)
const stamp = (e: Raw) => (e.allDay ? isoDay(e.start) : e.start.toISOString())

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const url = new URL(req.url)
  const authHeader = req.headers.get('Authorization') ?? ''
  const supaUrl = Deno.env.get('SUPABASE_URL')!
  const userClient = createClient(supaUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return json({ error: 'Não autenticada' }, 401)
  const admin = createClient(supaUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

  let params: Record<string, string> = Object.fromEntries(url.searchParams)
  if (req.method === 'POST') { try { params = { ...params, ...(await req.json()) } } catch { /* sem corpo */ } }
  const from = new Date(params.from ?? Date.now() - 7 * 864e5)
  const to = new Date(params.to ?? Date.now() + 35 * 864e5)
  if (isNaN(+from) || isNaN(+to) || +to - +from > 120 * 864e5) return json({ error: 'Intervalo inválido' }, 400)
  const onlyMine = String(params.only_mine) === '1'
  const refresh = String(params.refresh) === '1'

  const { data: myWs } = await admin.from('workspace_members').select('workspace_id').eq('user_id', user.id)
  let wsIds = (myWs ?? []).map(w => w.workspace_id)
  if (params.ws && wsIds.includes(params.ws)) wsIds = [params.ws]
  const { data: mates } = await admin.from('workspace_members').select('user_id').in('workspace_id', wsIds.length ? wsIds : ['00000000-0000-0000-0000-000000000000'])
  const ids = onlyMine ? [user.id] : [...new Set([user.id, ...(mates ?? []).map(m => m.user_id)])]
  const { data: feeds } = await admin.from('calendar_feeds').select('user_id, ics_url, share_details').in('user_id', ids)
  const { data: sec } = await admin.from('app_secrets').select('value').eq('key', 'ics_proxy').maybeSingle()

  const events: Ev[] = []
  const status: Record<string, string> = {}
  const agency_status: Record<string, string> = {}
  const seen = new Set<string>()

  await Promise.all((feeds ?? []).map(async f => {
    try {
      const { data: cache } = await admin.from('calendar_cache').select('fetched_at, ics').eq('user_id', f.user_id).maybeSingle()
      let ics = cache?.ics
      if (!ics || Date.now() - new Date(cache!.fetched_at).getTime() > TTL_MS || refresh) {
        const text = await fetchIcs(f.ics_url, sec?.value)
        if (!text.includes('BEGIN:VCALENDAR')) throw new Error('O link não é um calendário iCal')
        ics = text
        await admin.from('calendar_cache').upsert({ user_id: f.user_id, fetched_at: new Date().toISOString(), ics })
      }
      const mine = f.user_id === user.id
      for (const e of expand(ics, from, to)) {
        const busy = !mine && !f.share_details
        seen.add(`${e.title}|${stamp(e)}`)
        events.push({ owner_id: f.user_id, source: 'personal', title: busy ? 'Ocupada' : e.title, location: busy ? null : e.location, start: stamp(e), end: e.allDay ? isoDay(e.end) : e.end.toISOString(), all_day: e.allDay, busy_only: busy })
      }
      status[f.user_id] = 'ok'
    } catch (e) {
      status[f.user_id] = (e as Error).message
    }
  }))

  // agenda da agência (processos, palestras, marcos), compartilhada pelo workspace
  if (!onlyMine && wsIds.length) {
    const { data: agency } = await admin.from('workspace_calendars').select('workspace_id, ics_url, ics, fetched_at').in('workspace_id', wsIds)
    for (const a of agency ?? []) {
      try {
        let ics = a.ics
        if (!ics || !a.fetched_at || Date.now() - new Date(a.fetched_at).getTime() > TTL_MS || refresh) {
          const text = await fetchIcs(a.ics_url, sec?.value)
          if (!text.includes('BEGIN:VCALENDAR')) throw new Error('O link não é um calendário iCal')
          ics = text
          await admin.from('workspace_calendars').update({ ics, fetched_at: new Date().toISOString() }).eq('workspace_id', a.workspace_id)
        }
        for (const e of expand(ics!, from, to)) {
          const key = `${e.title}|${stamp(e)}`
          if (seen.has(key)) continue // já veio pela agenda pessoal
          seen.add(key)
          events.push({ owner_id: null, source: 'agency', title: e.title, location: e.location, start: stamp(e), end: e.allDay ? isoDay(e.end) : e.end.toISOString(), all_day: e.allDay, busy_only: false })
        }
        agency_status[a.workspace_id] = 'ok'
      } catch (e) {
        agency_status[a.workspace_id] = (e as Error).message
      }
    }
  }
  events.sort((a, b) => a.start.localeCompare(b.start))
  return json({ events, status, agency_status })
})
