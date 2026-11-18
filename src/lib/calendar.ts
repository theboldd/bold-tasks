import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { addDaysISO, todayISO } from './labels'
import type { CalEvent } from './types'

type CalCache = { at: number; events: CalEvent[]; status: Record<string, string>; agency: Record<string, string> }
const readCache = (k: string): CalCache | null => {
  try { const c = JSON.parse(localStorage.getItem(k) || 'null') as CalCache | null; return c && Date.now() - c.at < 12 * 3600e3 ? c : null } catch { return null }
}

/** Eventos do Google Agenda (pessoais + agência) no intervalo [from, to], atualizados a cada 3 min e ao voltar para o app.
 *  Mostra na hora a última leitura salva neste aparelho e atualiza em segundo plano. */
export function useCalendarEvents(from: string, to: string, cacheKey?: string) {
  const key = cacheKey ?? `bt_cal_${from}_${to}`
  const cached = readCache(key)
  const [events, setEvents] = useState<CalEvent[]>(cached?.events ?? [])
  const [status, setStatus] = useState<Record<string, string>>(cached?.status ?? {})
  const [agencyStatus, setAgencyStatus] = useState<Record<string, string>>(cached?.agency ?? {})
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(!!cached)
  useEffect(() => {
    const c = readCache(key)
    if (c) { setEvents(c.events); setStatus(c.status); setAgencyStatus(c.agency); setLoaded(true) }
  }, [key])
  const load = useCallback(async (refresh = false) => {
    setLoading(true)
    const { data, error } = await supabase.functions.invoke('calendar-events', { body: { from: `${from}T00:00:00-03:00`, to: `${addDaysISO(to, 1)}T00:00:00-03:00`, refresh: refresh ? '1' : undefined } })
    setLoading(false); setLoaded(true)
    if (error || !data) return
    setEvents(data.events ?? []); setStatus(data.status ?? {}); setAgencyStatus(data.agency_status ?? {})
    try {
      // guarda só a leitura mais recente de cada intervalo (evita encher o armazenamento)
      Object.keys(localStorage).filter(k => k.startsWith('bt_cal_2') && k !== key).slice(0, -6).forEach(k => localStorage.removeItem(k))
      localStorage.setItem(key, JSON.stringify({ at: Date.now(), events: data.events ?? [], status: data.status ?? {}, agency: data.agency_status ?? {} }))
    } catch { /* armazenamento cheio */ }
  }, [from, to, key])
  useEffect(() => {
    load()
    let last = Date.now()
    const tick = () => { if (Date.now() - last > 60 * 1000) { last = Date.now(); load() } }
    const i = setInterval(() => { last = Date.now(); load() }, 3 * 60 * 1000)
    const onVis = () => document.visibilityState === 'visible' && tick()
    document.addEventListener('visibilitychange', onVis); window.addEventListener('focus', tick)
    return () => { clearInterval(i); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('focus', tick) }
  }, [load])
  return { events, status, agencyStatus, loading, loaded, reload: load }
}

/* ===== Leitura dos processos da agência a partir dos eventos ===== */

const TZ = 'America/Sao_Paulo'
const MONTHS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']
const PROCESS = /produ[cç][aã]o|crono|revis|aprova|ajust|entrega|start|[uú]ltimo dia|dia que tudo|libera|formul[aá]rio|recesso|visualiz|coment[aá]rio/i
const ROUTINE = /alinhamento semanal|reservado|enviar mensagem|terapia|reuni[aã]o (designers|editores|estrategistas)/i
const HIGHLIGHT = /palestra|congresso|evento|presencial|grava[cç]|entrevista|viagem|workshop|aula|confra|live|podcast|feira|lan[cç]amento|diagn[oó]stico|semin[aá]rio|mentoria|curso|imers|sess[aã]o de fotos|ensaio|anive/i

const dayOf = (e: CalEvent) => (e.all_day ? e.start.slice(0, 10) : todayISO(new Date(e.start)))
/** último dia (inclusivo) de um evento */
const lastDayOf = (e: CalEvent) => (e.all_day ? addDaysISO(e.end.slice(0, 10), -1) : todayISO(new Date(e.end)))
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5)

/** "PRODUÇÃO CRONO JAN - ESTRATEGISTAS" → "Produção crono JAN · estrategistas" (sem travessões) */
export function prettyTitle(t: string) {
  const clean = t.replace(/\s+e Ag[eê]ncia Bold\b/i, '').replace(/\s+[-–—|]\s+/g, ' · ').replace(/\s*[-–—]\s*$/, '').replace(/\.\s*$/, '').replace(/\s{2,}/g, ' ').trim()
  if (clean !== clean.toUpperCase()) return clean
  const lower = clean.toLowerCase().replace(/\b(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\b/g, m => m.toUpperCase())
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

export const weekdayLabel = (d: string, today: string) => {
  const diff = daysBetween(today, d)
  if (diff === 0) return 'hoje'
  if (diff === 1) return 'amanhã'
  const wd = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' }).format(new Date(d + 'T12:00:00Z'))
  return `${wd}, ${d.slice(8)}/${d.slice(5, 7)}`
}

export const timeOf = (e: CalEvent) => (e.all_day ? null : new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(new Date(e.start)))

export interface Phase { title: string; raw: string; start: string; end: string; daysLeft: number; dayIndex: number; progress: number }
export interface Milestone { title: string; day: string; inDays: number }

export function agencyInsights(events: CalEvent[], today = todayISO()) {
  const pool = events.filter(e => !e.busy_only)
  // fases: eventos de dia inteiro, de processo, com 2 dias ou mais, acontecendo hoje
  const phases: Phase[] = pool
    .filter(e => e.all_day && PROCESS.test(e.title) && daysBetween(e.start.slice(0, 10), e.end.slice(0, 10)) >= 2)
    .filter(e => dayOf(e) <= today && today <= lastDayOf(e))
    .map(e => {
      const total = Math.max(1, daysBetween(dayOf(e), lastDayOf(e)) + 1)
      const done = daysBetween(dayOf(e), today) + 1
      return { title: prettyTitle(e.title), raw: e.title, start: dayOf(e), end: lastDayOf(e), daysLeft: daysBetween(today, lastDayOf(e)), dayIndex: daysBetween(dayOf(e), today), progress: Math.min(1, done / total) }
    })
    .sort((a, b) => a.daysLeft - b.daysLeft)
  // marcos: processos de 1 dia (ou começo de fase) nos próximos 10 dias
  const seen = new Set<string>()
  const milestones: Milestone[] = pool
    .filter(e => e.all_day && PROCESS.test(e.title) && dayOf(e) > today && daysBetween(today, dayOf(e)) <= 10)
    .map(e => ({ title: prettyTitle(e.title), day: dayOf(e), inDays: daysBetween(today, dayOf(e)) }))
    .filter(m => (seen.has(m.title) ? false : (seen.add(m.title), true)))
    .sort((a, b) => a.inDays - b.inDays)
  // destaques: o que não é processo nem rotina e chama atenção (palestra, presencial, evento...)
  const isHighlight = (e: CalEvent) => !PROCESS.test(e.title) && !ROUTINE.test(e.title) && (HIGHLIGHT.test(e.title) || (!!e.location && !/meet\.google|google meet|zoom/i.test(e.location)))
  const todayHl = pool.filter(e => isHighlight(e) && dayOf(e) <= today && today <= lastDayOf(e))
  const tomorrow = addDaysISO(today, 1)
  const tomorrowHl = pool.filter(e => isHighlight(e) && dayOf(e) === tomorrow)
  const soonHl = pool.filter(e => isHighlight(e) && dayOf(e) > tomorrow && daysBetween(today, dayOf(e)) <= 7)
  const rank = (e: CalEvent) => (/palestra|congresso|evento|semin|confra|lan[cç]amento|feira/i.test(e.title) ? 0 : /presencial|grava|entrevista|viagem|workshop|aula|live|podcast/i.test(e.title) ? 1 : 2)
  todayHl.sort((a, b) => rank(a) - rank(b) || a.start.localeCompare(b.start))
  const uniq = (l: CalEvent[]) => { const k = new Set<string>(); return l.filter(e => { const x = e.title + dayOf(e); if (k.has(x)) return false; k.add(x); return true }) }
  const marksToday = pool.filter(e => e.all_day && PROCESS.test(e.title) && daysBetween(e.start.slice(0, 10), e.end.slice(0, 10)) < 2 && dayOf(e) === today).map(e => e.title)
  return { phases, marksToday, milestones: milestones.slice(0, 4), today: uniq(todayHl), tomorrow: uniq(tomorrowHl), soon: uniq(soonHl).slice(0, 3) }
}

export const monthLabel = (iso: string) => MONTHS[Number(iso.slice(5, 7)) - 1]
