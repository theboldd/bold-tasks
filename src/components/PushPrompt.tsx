import { useEffect, useState } from 'react'
import { BellRing, Share, X } from 'lucide-react'
import { currentSubscription, enablePush, isIOS, isStandalone, pushSupported } from '../lib/push'
import { useToast, useWs } from '../lib/store'

const KEY = 'bt_push_prompt_until'
const snoozed = () => { try { return Number(localStorage.getItem(KEY) || 0) > Date.now() } catch { return false } }
const snooze = (days: number) => { try { localStorage.setItem(KEY, String(Date.now() + days * 864e5)) } catch { /* sem storage */ } }

type Mode = 'ask' | 'ios-install' | null

/** Convite para ativar notificações no primeiro acesso de cada aparelho (sem precisar ir em Configurações). */
export function PushPrompt() {
  const { me } = useWs()
  const toast = useToast()
  const [mode, setMode] = useState<Mode>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    const t = setTimeout(async () => {
      if (snoozed()) return
      // iPhone/iPad: notificações só funcionam com o app adicionado à Tela de Início
      if (isIOS() && !isStandalone()) { if (alive) setMode('ios-install'); return }
      if (!pushSupported()) return
      const perm = Notification.permission
      if (perm === 'denied') return
      const sub = await currentSubscription()
      if (perm === 'granted') {
        // já autorizado neste aparelho: garante que a inscrição está salva, sem perguntar
        if (!sub) await enablePush()
        return
      }
      if (alive) setMode('ask')
    }, 1500)
    return () => { alive = false; clearTimeout(t) }
  }, [me.id])

  if (!mode) return null
  const first = me.name.split(' ')[0]
  const later = () => { snooze(3); setMode(null) }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[85] p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] md:pb-0 md:inset-x-auto md:bottom-6 md:right-6 md:w-[380px] md:p-0" role="dialog" aria-label="Ativar notificações" data-testid="push-prompt">
      <div className="rise-in relative rounded-2xl border border-line bg-paper p-5 shadow-[0_24px_60px_-24px_rgba(21,19,19,.55)]">
        <button aria-label="Fechar" className="absolute right-3 top-3 rounded-full p-1.5 text-mute hover:bg-line/60 hover:text-ink" onClick={later}><X size={16} /></button>
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-bordo-50 text-bordo"><BellRing size={19} strokeWidth={1.7} /></div>
        {mode === 'ask' ? <>
          <h2 className="font-serif text-[1.5rem] leading-tight">{first}, ative as notificações</h2>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-mute">Receba neste aparelho os lembretes de horário, prazos e quando a outra concluir uma parte, mesmo com o app fechado.</p>
          <div className="mt-4 flex gap-2">
            <button className="btn btn-primary flex-1 py-2.5" disabled={busy} data-testid="push-prompt-enable" onClick={async () => {
              setBusy(true); const r = await enablePush(); setBusy(false)
              if (r === 'ok') { toast('Notificações ativadas neste aparelho'); setMode(null) }
              else if (r === 'denied') { toast('Permissão negada. Dá para ativar depois em Configurações.', 'error'); snooze(30); setMode(null) }
              else { toast('Não foi possível ativar agora. Tente em Configurações.', 'error'); later() }
            }}>{busy ? 'Ativando…' : 'Ativar notificações'}</button>
            <button className="btn btn-ghost py-2.5" onClick={later}>Agora não</button>
          </div>
        </> : <>
          <h2 className="font-serif text-[1.5rem] leading-tight">{first}, instale o app para receber avisos</h2>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-mute">No iPhone, as notificações só funcionam com o BOLD TASKS na Tela de Início:</p>
          <ol className="mt-3 space-y-1.5 text-[13.5px]">
            <li className="flex items-center gap-2"><span className="num flex h-5 w-5 items-center justify-center rounded-full bg-bordo-50 text-[11px] text-bordo">1</span>Toque em <Share size={14} className="inline text-bordo" /> <strong className="font-medium">Compartilhar</strong> no Safari</li>
            <li className="flex items-center gap-2"><span className="num flex h-5 w-5 items-center justify-center rounded-full bg-bordo-50 text-[11px] text-bordo">2</span>Escolha <strong className="font-medium">Adicionar à Tela de Início</strong></li>
            <li className="flex items-center gap-2"><span className="num flex h-5 w-5 items-center justify-center rounded-full bg-bordo-50 text-[11px] text-bordo">3</span>Abra pelo ícone e entre uma vez; o convite aparece lá</li>
          </ol>
          <button className="btn btn-ghost mt-4 w-full py-2.5" onClick={later}>Entendi</button>
        </>}
      </div>
    </div>
  )
}
