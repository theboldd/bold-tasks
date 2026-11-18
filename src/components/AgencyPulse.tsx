import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, MapPin, Sparkles } from 'lucide-react'
import { useWs } from '../lib/store'
import { addDaysISO, firstName, todayISO } from '../lib/labels'
import { agencyInsights, prettyTitle, timeOf, useCalendarEvents, weekdayLabel } from '../lib/calendar'
import type { CalEvent } from '../lib/types'

function hash(s: string) { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h }

const PERSONAL = [
  'Caramba, {nome}, tem noção que hoje tem {ev}{onde}{hora}? Separa a roupa e arrasa!',
  '{nome}, alerta de agenda: hoje é dia de {ev}{onde}{hora}. Brilha!',
  'Não esquece, {nome}: {ev} hoje{onde}{hora}. Água, café e confiança.',
  '{nome}, hoje tem {ev}{onde}{hora}. Respira fundo que o palco é seu.',
  'Olha só, {nome}: {ev}{onde}{hora} está na sua agenda de hoje. Vai lá e mostra quem é a Bold!',
]
const TEAM = [
  'Olha, {nome}: hoje tem {ev}{onde}{hora} na agenda da agência.',
  '{nome}, fica de olho: {ev} hoje{onde}{hora}.',
  'Na agenda da agência hoje: {ev}{onde}{hora}. Bora dar aquele apoio!',
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
  const { events, status, agencyStatus, loaded } = useCalendarEvents(addDaysISO(today, -40), addDaysISO(today, 12))
  const ins = useMemo(() => agencyInsights(events, today), [events, today])
  const isOwner = members.find(m => m.user_id === me.id)?.role === 'owner'
  const nome = firstName(me.name)
  const hasAnyFeed = Object.keys(status).length > 0 || Object.keys(agencyStatus).length > 0

  if (!loaded) return null
  if (!hasAnyFeed) {
    return (
      <Link to="/configuracoes" className="mb-8 flex items-center gap-3 rounded-2xl border border-dashed border-line px-4 py-3 text-sm text-mute transition hover:border-bordo hover:text-ink" data-testid="agency-connect">
        <CalendarClock size={17} /><span className="flex-1">Conecte o Google Agenda e a agenda da agência para receber avisos de palestras, compromissos e das fases de produção.</span>
      </Link>
    )
  }
  const hl = ins.today[0]
  const nothing = !hl && !ins.tomorrow.length && !ins.phases.length && !ins.milestones.length
  if (nothing) return null

  return (
    <section className="mb-8 grid grid-cols-1 items-start gap-4 lg:grid-cols-5" aria-label="Agenda e ciclo da agência" data-testid="agency-pulse">
      {/* destaques da agenda */}
      {(hl || ins.tomorrow.length > 0 || ins.soon.length > 0) && (
        <div className={`rounded-2xl border p-5 md:p-6 ${hl ? 'border-bordo/25 bg-bordo-50' : 'border-line bg-paper'} ${ins.phases.length || ins.milestones.length ? 'lg:col-span-3' : 'lg:col-span-5'}`}>
          <div className="eyebrow mb-2 flex items-center gap-1.5 text-bordo"><Sparkles size={13} />Agenda</div>
          {hl && (
            <p className="font-serif text-[1.45rem] leading-snug md:text-[1.6rem]" data-testid="agenda-highlight">
              {phrase(hl, nome, isOwner || hl.owner_id === me.id, today)}
            </p>
          )}
          {ins.today.length > 1 && <p className="mt-2 text-sm text-mute">Hoje também: {ins.today.slice(1).map(e => prettyTitle(e.title)).join(' · ')}</p>}
          {ins.tomorrow.length > 0 && <p className={`${hl ? 'mt-3' : ''} text-[14.5px]`}>{hl ? 'E amanhã' : `${nome}, amanhã`} tem <strong className="font-semibold">{ins.tomorrow.map(e => `${prettyTitle(e.title)}${timeOf(e) ? ` às ${timeOf(e)}` : ''}`).join(' e ')}</strong>.</p>}
          {ins.soon.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {ins.soon.map(e => (
                <li key={e.title + e.start} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1 text-[12.5px]">
                  <span className="meta text-[10.5px] uppercase tracking-wider text-bordo">{weekdayLabel(e.all_day ? e.start.slice(0, 10) : todayISO(new Date(e.start)), today).split(',')[0]}</span>
                  {prettyTitle(e.title)}{e.location && !/meet/i.test(e.location) && <MapPin size={11} className="text-mute" />}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ciclo da agência */}
      {(ins.phases.length > 0 || ins.milestones.length > 0) && (
        <div className={`rounded-2xl border border-line bg-paper p-5 md:p-6 ${hl || ins.tomorrow.length || ins.soon.length ? 'lg:col-span-2' : 'lg:col-span-5'}`} data-testid="agency-cycle">
          <div className="eyebrow mb-3 flex items-center gap-1.5"><CalendarClock size={13} />Ciclo da agência</div>
          <ul className="space-y-3">
            {ins.phases.slice(0, 3).map(p => (
              <li key={p.title}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[14px] font-medium leading-snug">{p.title}</span>
                  <span className={`meta shrink-0 text-[11px] ${p.daysLeft <= 1 ? 'font-semibold text-late' : 'text-mute'}`}>
                    {p.daysLeft === 0 ? 'acaba hoje' : p.daysLeft === 1 ? 'acaba amanhã' : `acaba em ${p.daysLeft} dias`}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-bordo transition-all duration-700" style={{ width: `${Math.round(p.progress * 100)}%` }} /></div>
                <div className="meta mt-1 text-[10.5px] text-mute">até {weekdayLabel(p.end, today)}</div>
              </li>
            ))}
          </ul>
          {ins.milestones.length > 0 && (
            <div className={ins.phases.length ? 'mt-4 border-t border-line pt-3' : ''}>
              <div className="meta mb-1.5 text-[10.5px] uppercase tracking-[.16em] text-mute">Próximos marcos</div>
              <ul className="space-y-1.5 text-[13px]">
                {ins.milestones.map(m => (
                  <li key={m.title} className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate">{m.title}</span>
                    <span className="meta shrink-0 text-[11px] text-bordo">{m.inDays === 1 ? 'amanhã' : `em ${m.inDays} dias`}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
