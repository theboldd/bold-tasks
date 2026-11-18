import { useEffect, useState } from 'react'
import { Bell, CalendarDays } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast, useWs } from '../lib/store'
import { PageHeader } from '../components/ui'
import { currentSubscription, disablePush, enablePush, isIOS, isStandalone, pushSupported } from '../lib/push'

export function SettingsPage() {
  const { me, members, workspace, realtimeStatus } = useWs()
  const toast = useToast()
  const [name, setName] = useState(me.name)
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)

  return (
    <div className="max-w-2xl">
      <PageHeader eyebrow="Conta" title="Configurações" />
      <PushCard />
      <GoogleCard />
      <section className="card p-6 mb-6">
        <h2 className="font-serif text-xl mb-4">Perfil</h2>
        <form className="flex flex-wrap items-end gap-3" onSubmit={async e => {
          e.preventDefault(); if (!name.trim()) return
          setBusy(true)
          const { error } = await supabase.from('profiles').update({ name: name.trim() }).eq('id', me.id)
          setBusy(false)
          if (error) toast(error.message, 'error'); else { toast('Nome atualizado'); setTimeout(() => location.reload(), 600) }
        }}>
          <label className="flex-1 min-w-52"><span className="eyebrow mb-1.5 block">Nome</span><input className="field" value={name} onChange={e => setName(e.target.value)} /></label>
          <button className="btn btn-primary" disabled={busy || name.trim() === me.name}>Salvar</button>
        </form>
        <p className="mt-3 text-sm text-mute">E-mail de acesso: {me.email}</p>
      </section>
      <section className="card p-6 mb-6">
        <h2 className="font-serif text-xl mb-4">Alterar senha</h2>
        <form className="flex flex-wrap items-end gap-3" onSubmit={async e => {
          e.preventDefault(); if (pw.length < 8) return toast('Mínimo de 8 caracteres', 'error')
          setBusy(true)
          const { error } = await supabase.auth.updateUser({ password: pw })
          setBusy(false)
          if (error) toast(error.message, 'error'); else { toast('Senha alterada'); setPw('') }
        }}>
          <label className="flex-1 min-w-52"><span className="eyebrow mb-1.5 block">Nova senha</span><input type="password" autoComplete="new-password" className="field" value={pw} onChange={e => setPw(e.target.value)} /></label>
          <button className="btn btn-primary" disabled={busy || !pw}>Alterar</button>
        </form>
      </section>
      <section className="card p-6">
        <h2 className="font-serif text-xl mb-1">Workspace</h2>
        <p className="text-sm text-mute mb-4">{workspace.name} · sincronização {realtimeStatus === 'SUBSCRIBED' ? <span className="text-ok">em tempo real</span> : <span className="text-wait">reconectando…</span>}</p>
        <ul className="divide-y divide-line text-sm">
          {members.map(m => <li key={m.user_id} className="flex justify-between py-2"><span>{m.profile.name}</span><span className="text-mute">{m.profile.email}</span></li>)}
        </ul>
        <p className="mt-4 text-xs text-mute">Ambas têm acesso integral ao workspace. Permissões garantidas no banco de dados (RLS).</p>
      </section>
    </div>
  )
}

function PushCard() {
  const toast = useToast()
  const [state, setState] = useState<'loading' | 'on' | 'off' | 'denied' | 'unsupported' | 'ios-install'>('loading')
  const [busy, setBusy] = useState(false)
  const refresh = async () => {
    if (isIOS() && !isStandalone()) return setState('ios-install')
    if (!pushSupported()) return setState('unsupported')
    if (Notification.permission === 'denied') return setState('denied')
    setState((await currentSubscription()) ? 'on' : 'off')
  }
  useEffect(() => { refresh() }, [])
  return (
    <section className="card p-6 mb-6" data-testid="push-card">
      <h2 className="font-serif text-xl mb-1 flex items-center gap-2"><Bell size={18} />Notificações neste aparelho</h2>
      <p className="text-sm text-mute mb-4">Lembretes como “Rebeca, tal pendência precisa ser resolvida até o final da manhã”, o resumo do dia às 8h e os avisos de conclusão chegam aqui mesmo com o BOLD TASKS fechado. Ative em cada aparelho que você usa (computador e celular).</p>
      {state === 'ios-install' && <p className="rounded-xl bg-wait-50 px-3 py-2 text-sm text-wait">No iPhone: toque em <strong>Compartilhar</strong> → <strong>Adicionar à Tela de Início</strong>, abra o BOLD TASKS pelo ícone e volte aqui para ativar.</p>}
      {state === 'unsupported' && <p className="text-sm text-late">Este navegador não aceita notificações. Use Chrome, Edge ou Safari atualizados.</p>}
      {state === 'denied' && <p className="text-sm text-late">As notificações foram bloqueadas neste navegador. Libere nas configurações do site (ícone de cadeado ao lado do endereço) e recarregue a página.</p>}
      {(state === 'on' || state === 'off') && (
        <div className="flex flex-wrap items-center gap-2">
          {state === 'off'
            ? <button className="btn btn-primary" disabled={busy} onClick={async () => { setBusy(true); const r = await enablePush(); setBusy(false); toast(r === 'ok' ? 'Notificações ativadas neste aparelho' : r === 'denied' ? 'Permissão negada pelo navegador' : 'Não foi possível ativar', r === 'ok' ? 'ok' : 'error'); refresh() }}>Ativar notificações</button>
            : <>
                <span className="rounded-full bg-ok-50 px-3 py-1.5 text-sm text-ok">Ativadas neste aparelho</span>
                <button className="btn btn-ghost" disabled={busy} onClick={async () => { setBusy(true); const { error } = await supabase.rpc('send_test_push'); setBusy(false); toast(error ? error.message : 'Teste enviado — deve chegar em segundos', error ? 'error' : 'ok') }}>Enviar teste</button>
                <button className="btn btn-text" onClick={async () => { await disablePush(); refresh() }}>Desativar</button>
              </>}
        </div>
      )}
    </section>
  )
}

function GoogleCard() {
  const { me } = useWs()
  const toast = useToast()
  const [url, setUrl] = useState('')
  const [share, setShare] = useState(false)
  const [saved, setSaved] = useState<{ ics_url: string; share_details: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState('')
  useEffect(() => {
    supabase.from('calendar_feeds').select('ics_url, share_details').eq('user_id', me.id).maybeSingle().then(({ data }) => {
      if (data) { setSaved(data); setUrl(data.ics_url); setShare(data.share_details) }
    })
  }, [me.id])
  const test = async () => {
    const from = new Date().toISOString(), to = new Date(Date.now() + 14 * 864e5).toISOString()
    const { data, error } = await supabase.functions.invoke('calendar-events', { body: { from, to, refresh: '1', only_mine: '1' } })
    if (error) return setResult('Não foi possível ler a agenda.')
    const st = data?.status?.[me.id]
    setResult(st === 'ok' ? `Conectado: ${data.events.length} compromisso(s) nos próximos 14 dias.` : `Erro: ${st ?? 'link não encontrado'}`)
  }
  const save = async () => {
    const v = url.trim()
    if (!/^(https|webcal):\/\/.+/.test(v)) return toast('Cole o endereço secreto no formato iCal (começa com https://)', 'error')
    setBusy(true)
    const { error } = await supabase.from('calendar_feeds').upsert({ user_id: me.id, ics_url: v, share_details: share, updated_at: new Date().toISOString() })
    if (error) { setBusy(false); return toast(error.message, 'error') }
    setSaved({ ics_url: v, share_details: share }); await test(); setBusy(false)
  }
  return (
    <section className="card p-6 mb-6" data-testid="google-card">
      <h2 className="font-serif text-xl mb-1 flex items-center gap-2"><CalendarDays size={18} />Google Agenda</h2>
      <p className="text-sm text-mute mb-3">Seus compromissos aparecem no Calendário do BOLD TASKS, na grade de horários, para encaixar as pendências nas janelas livres.</p>
      <ol className="mb-4 list-decimal space-y-0.5 pl-5 text-sm text-mute">
        <li>No Google Agenda (computador), abra <strong>Configurações</strong> (engrenagem).</li>
        <li>Em <strong>Configurações das minhas agendas</strong>, clique na sua agenda → <strong>Integrar agenda</strong>.</li>
        <li>Copie o <strong>Endereço secreto no formato iCal</strong> e cole abaixo.</li>
      </ol>
      <input aria-label="Endereço secreto iCal" className="field mb-3 font-mono text-xs" placeholder="https://calendar.google.com/calendar/ical/.../private-.../basic.ics" value={url} onChange={e => setUrl(e.target.value)} />
      <label className="mb-4 flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 accent-[#3A0000]" checked={share} onChange={e => setShare(e.target.checked)} />
        <span>Mostrar os títulos dos meus compromissos para a outra usuária <span className="text-mute">(desmarcado: ela vê apenas “Ocupada” nos seus horários)</span></span></label>
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-primary" disabled={busy || !url.trim()} onClick={save}>{busy ? 'Conectando…' : saved ? 'Salvar alterações' : 'Conectar agenda'}</button>
        {saved && <button className="btn btn-ghost" disabled={busy} onClick={async () => { setBusy(true); await test(); setBusy(false) }}>Testar</button>}
        {saved && <button className="btn btn-text text-late" onClick={async () => { await supabase.from('calendar_feeds').delete().eq('user_id', me.id); setSaved(null); setUrl(''); setResult(''); toast('Agenda desconectada') }}>Desconectar</button>}
      </div>
      {result && <p className={`mt-3 text-sm ${result.startsWith('Conectado') ? 'text-ok' : 'text-late'}`} data-testid="google-result">{result}</p>}
      <p className="mt-3 text-xs text-mute">O endereço fica guardado só para você e é lido pelo servidor; nunca é mostrado para a outra usuária. Atualização a cada 15 minutos.</p>
    </section>
  )
}
