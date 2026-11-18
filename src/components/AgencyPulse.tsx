import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, Sparkles } from 'lucide-react'
import { useWs } from '../lib/store'
import { addDaysISO, firstName, todayISO } from '../lib/labels'
import { agencyInsights, prettyTitle, timeOf, useCalendarEvents, weekdayLabel } from '../lib/calendar'
import type { CalEvent } from '../lib/types'
import { processTip, whoFromName } from '../lib/process'

function hash(s: string) { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h }

const PERSONAL = [
  'Caramba, {nome}, tem noção que hoje tem {ev}{onde}{hora}? Arrasa! 🎤✨',
  '{nome}, alerta de agenda: hoje é dia de {ev}{onde}{hora}. Brilha! 🌟',
  'Não esquece, {nome}: {ev} hoje{onde}{hora}. Água, café e confiança. ☕💧',
  '{nome}, hoje tem {ev}{onde}{hora}. O palco é seu. 🎤',
  'Olha só, {nome}: hoje tem {ev}{onde}{hora}. Mostra quem é a Bold! 🔥',
]
const TEAM = [
  'Olha, {nome}: hoje tem {ev}{onde}{hora} na agenda da agência. 📅',
  '{nome}, fica de olho: {ev} hoje{onde}{hora}. 👀',
  'Na agenda da agência hoje: {ev}{onde}{hora}. Bora dar aquele apoio! 🙌',
]

function phrase(e: CalEvent, nome: string, personal: boolean, today: string) {
  const bank = personal ? PERSONAL : TEAM
  const tpl = bank[hash(e.title + today) % bank.length]
  const t = timeOf(e)
  const onde = e.location && !/meet\.google|google meet|zoom/i.test(e.location) ? ` em ${e.location.split(',')[0]}` : ''
  return tpl.replace('{nome}', nome).replace('{ev}', prettyTitle(e.title)).replace('{onde}', onde).replace('{hora}', t ? ` às ${t}` : '')
}

/** Avisos da agenda (palestras, presenciais) e do ciclo de processos da agência, no dashboard. */
export function AgencyPulse() {
  const { me, members } = useWs()
  const today = todayISO()
  const { events, status, agencyStatus, loaded } = useCalendarEvents(addDaysISO(today, -40), addDaysISO(today, 12), 'bt_cal_dash')
  const ins = useMemo(() => agencyInsights(events, today), [events, today])
  const isOwner = members.find(m => m.user_id === me.id)?.role === 'owner'
  const nome = firstName(me.name)
  const hasAnyFeed = Object.keys(status).length > 0 || Object.keys(agencyStatus).length > 0

  if (!loaded) return null
  if (!hasAnyFeed) {
    return (
      <Link to="/configuracoes" className="mt-4 inline-flex items-center gap-2 text-[13px] text-mute transition hover:text-bordo" data-testid="agency-connect">
        <CalendarClock size={14} /><span>Conecte a agenda da agência para ver aqui palestras e fases de produção.</span>
      </Link>
    )
  }
  const hl = ins.today[0]
  const ends = (p: { daysLeft: number; end: string }) => (p.daysLeft === 0 ? 'acaba hoje' : p.daysLeft === 1 ? 'acaba amanhã' : `acaba em ${p.daysLeft} dias (${weekdayLabel(p.end, today).split(',')[0]})`)
  const low = (t: string) => t.charAt(0).toLowerCase() + t.slice(1)
  const cycleLines: string[] = ins.phases.slice(0, 3).map((p, i) => i === 0 ? `${hl ? 'E na agência, ' : 'Na agência, '}${low(p.title)} ${ends(p)}.` : `${p.title} ${ends(p)}.`)
  if (!cycleLines.length && ins.milestones[0]) cycleLines.push(`Próximo marco da agência: ${low(ins.milestones[0].title)}, ${ins.milestones[0].inDays === 1 ? 'amanhã' : `em ${ins.milestones[0].inDays} dias`}.`)
  const tom = ins.tomorrow[0]
  const agenda = hl ? phrase(hl, nome, isOwner || hl.owner_id === me.id, today)
    : tom ? `${nome}, amanhã tem ${prettyTitle(tom.title)}${timeOf(tom) ? ` às ${timeOf(tom)}` : ''}.` : ''
  const tip = processTip(whoFromName(nome), ins.phases, ins.marksToday)
  if (!agenda && !cycleLines.length && !tip) return null

  return (
    <p className="fade-in mt-5 flex w-fit max-w-3xl items-start gap-2.5 rounded-2xl bg-ink px-5 py-3.5 font-serif text-[1.2rem] italic leading-snug text-off shadow-[0_14px_34px_-24px_rgba(21,19,19,.6)] md:text-[1.3rem]" data-testid="agency-pulse">
      <Sparkles size={15} className="mt-1.5 shrink-0 text-[#C98A95] dark:text-[#6A1E33]" />
      <span>
        {agenda && <span className="block">{agenda}</span>}
        {cycleLines.map((c, i) => <span key={i} className={`block ${agenda ? 'text-off/70' : ''} ${i === 0 && agenda ? 'mt-1' : ''}`}>{c}</span>)}
        {tip && <span className="mt-1.5 block not-italic font-sans text-[13.5px] text-off/80">{tip}</span>}
      </span>
    </p>
  )
}
