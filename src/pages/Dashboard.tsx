import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Inbox, Plus, RefreshCw, Zap } from 'lucide-react'
import { dailyMessage } from '../lib/messages'
import { AgencyPulse } from '../components/AgencyPulse'
import { useWs } from '../lib/store'
import { useUI } from '../lib/ui'
import { PRIORITY_RANK, addDaysISO, dayLabel, firstName, isDueToday, isForToday, isOpen, isOverdue, isTimePassed, todayISO, weekStartISO } from '../lib/labels'
import { dayCmp } from '../lib/filters'
import type { Task } from '../lib/types'
import { MiniTask } from '../components/TaskViews'
import { Spinner } from '../components/ui'

function attentionSort(a: Task, b: Task) {
  const today = todayISO()
  const score = (t: Task) => (isOverdue(t, today) ? 0 : isForToday(t, today) || isDueToday(t, today) ? 1 : t.priority === 'alta' ? 2 : t.status === 'em_andamento' ? 3 : 4)
  return score(a) - score(b) || dayCmp(a, b) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
}

export function Dashboard() {
  const { me, other, tasks, tasksLoaded, isMine, partsOf } = useWs()
  const { openNew } = useUI()
  const today = todayISO()
  const [shuffle, setShuffle] = useState(0)

  const s = useMemo(() => {
    const open = tasks.filter(isOpen)
    const ws = weekStartISO(today)
    const myPartDone = (t: Task) => t.is_shared && !!partsOf(t.id).find(p => p.user_id === me.id)?.completed_at
    const mineOpen = open.filter(t => isMine(t, me.id) && !myPartDone(t))
    return {
      // indicadores pessoais: só as minhas + as juntas em que minha parte ainda falta
      myOpen: mineOpen,
      myOverdue: mineOpen.filter(t => isOverdue(t, today)),
      myToday: mineOpen.filter(t => isForToday(t, today)),
      myWaiting: mineOpen.filter(t => t.status === 'aguardando'),
      myDoneWeek: tasks.filter(t => isMine(t, me.id) && (t.is_shared
        ? (() => { const at = partsOf(t.id).find(p => p.user_id === me.id)?.completed_at; return !!at && todayISO(new Date(at)) >= ws })()
        : t.status === 'concluida' && !!t.completed_at && todayISO(new Date(t.completed_at)) >= ws)).length,
      other: other ? open.filter(t => isMine(t, other.user_id)) : [],
      team: open.filter(t => t.is_team),
      waiting: open.filter(t => t.status === 'aguardando'),
      triage: open.filter(t => t.needs_triage),
      upcoming: mineOpen.filter(t => t.due_date && t.due_date >= today && t.due_date <= addDaysISO(today, 7)).sort((a, b) => a.due_date!.localeCompare(b.due_date!)),
    }
  }, [tasks, me.id, other, today, isMine, partsOf])

  if (!tasksLoaded) return <Spinner />

  const hour = Number(new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hour12: false, timeZone: 'America/Sao_Paulo' }).format(new Date()))
  const greet = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
  const otherName = other ? firstName(other.profile.name) : 'equipe'
  const dateStr = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' }).format(new Date())
  const rolled = s.myToday.filter(t => t.rollover_count > 0).length
  const passed = s.myToday.filter(isTimePassed).length

  const kpis: { label: string; value: number; to: string; tone?: Tone; testid?: string }[] = [
    { label: 'Minhas pendências', value: s.myOpen.length, to: '/minhas', tone: 'brand', testid: 'kpi-Abertas' },
    { label: 'Para hoje', value: s.myToday.length, to: '/minhas?day=today', tone: s.myToday.length ? 'soft' : undefined },
    { label: 'Atrasadas', value: s.myOverdue.length, to: '/minhas?overdue=1', tone: s.myOverdue.length ? 'late' : undefined, testid: 'kpi-Atrasadas' },
    { label: 'Aguardando retorno', value: s.myWaiting.length, to: '/aguardando', tone: s.myWaiting.length ? 'wait' : undefined },
    { label: `Com ${otherName}`, value: s.other.length, to: '/outra' },
    { label: 'Equipe The Bold', value: s.team.length, to: '/the-bold' },
    { label: 'Concluídas na semana', value: s.myDoneWeek, to: '/minhas?status=concluida&sort=created', tone: 'ok', testid: 'kpi-Concluídas na semana' },
  ]

  return (
    <div className="rise-in">
      <div className="mb-6 md:mb-8">
        <div className="eyebrow mb-2 first-letter:uppercase">{dateStr}</div>
        <h1 className="display text-[2.4rem] md:text-[3.4rem]">{greet}, <em className="font-normal italic text-bordo">{firstName(me.name)}</em>.</h1>
        <p className="mt-3 flex max-w-2xl items-start gap-2 text-[16.5px] leading-relaxed text-ink/85" data-testid="summary">
          <span>{dailyMessage({ name: firstName(me.name), userId: me.id, today: s.myToday.length, late: passed > 0 || s.myOverdue.length > 0, open: s.myOpen.length, seedExtra: shuffle })}</span>
          <button aria-label="Outra mensagem" title="Outra mensagem" data-testid="shuffle-message" onClick={() => setShuffle(x => x + 1)} className="mt-1 shrink-0 rounded-full p-1 text-mute/70 transition hover:rotate-180 hover:text-bordo duration-300"><RefreshCw size={13} /></button>
        </p>
        {s.myToday.length > 0 && (
          <p className="mt-1.5 text-[13px] text-mute">
            {[rolled > 0 && `${rolled} ${rolled === 1 ? 'veio' : 'vieram'} de dias anteriores`, passed > 0 && `${passed} já ${passed === 1 ? 'passou' : 'passaram'} do horário`, 'o que não for concluído hoje passa para amanhã automaticamente'].filter(Boolean).map((x, i, arr) => (
              <span key={i} className={i === 1 && passed > 0 && rolled > 0 || (i === 0 && passed > 0 && rolled === 0) ? 'text-late' : ''}>{i === 0 ? String(x).charAt(0).toUpperCase() + String(x).slice(1) : x}{i < arr.length - 1 ? ' · ' : '.'}</span>
            ))}
          </p>
        )}
      </div>

      {(s.myOverdue.length > 0 || s.triage.length > 0) && (
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="alerts">
          {s.myOverdue.length > 0 && (
            <Link to="/minhas?overdue=1" className="flex items-center gap-3 rounded-2xl border border-late/30 bg-late-50 px-4 py-3 text-sm text-late transition hover:border-late/60">
              <AlertTriangle size={17} /><span className="flex-1"><strong>{s.myOverdue.length}</strong> com prazo final vencido</span><ArrowRight size={15} />
            </Link>
          )}
          {s.triage.length > 0 && (
            <Link to="/a-classificar" className="flex items-center gap-3 rounded-2xl border border-wait/30 bg-wait-50 px-4 py-3 text-sm text-wait transition hover:border-wait/60">
              <Inbox size={17} /><span className="flex-1"><strong>{s.triage.length}</strong> captura(s) aguardando classificação</span><ArrowRight size={15} />
            </Link>
          )}
        </div>
      )}

      <AgencyPulse />

      {/* indicadores */}
      <section aria-label="Indicadores" className="mb-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line shadow-[0_14px_34px_-28px_rgba(21,19,19,.45)] sm:grid-cols-4 lg:grid-cols-7 [&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1">
        {kpis.map(k => <Kpi key={k.label} {...k} />)}
      </section>


      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 [&>section]:min-w-0">
        <ByDay />

        <section className="card p-5 md:p-6" aria-label="Ações rápidas">
          <SectionHead title="Ações rápidas" />
          <div className="flex flex-col gap-2">
            <button className="btn btn-primary justify-center py-2.5" onClick={() => openNew()}><Plus size={16} />Nova pendência</button>
            <button className="btn btn-ghost justify-center py-2.5" onClick={() => openNew({ mode: 'quick' })}><Zap size={15} />Adicionar rapidamente</button>
            {other && <button className="btn btn-ghost justify-center py-2.5" onClick={() => openNew({ assigned_to: other.user_id })}>Atribuir para {otherName}</button>}
            <button className="btn btn-ghost justify-center py-2.5" onClick={() => openNew({ team: true })}>Atribuir para a equipe The Bold</button>
          </div>
        </section>

        <section className="card p-5 md:p-6 lg:col-span-2" aria-label={`Pendências da ${otherName}`}>
          <SectionHead title={`Pendências da ${otherName}`} to="/outra" />
          {s.other.length ? <ul className="divide-y divide-line">{[...s.other].sort(attentionSort).slice(0, 6).map(t => <MiniTask key={t.id} task={t} />)}</ul>
            : <Quiet>Nenhuma pendência aberta com {otherName}.</Quiet>}
        </section>

        <section className="card p-5 md:p-6" aria-label="Próximos 7 dias">
          <SectionHead title="Próximos 7 dias" to="/calendario" />
          {s.upcoming.length ? <ul className="divide-y divide-line">{s.upcoming.slice(0, 7).map(t => <MiniTask key={t.id} task={t} />)}</ul>
            : <Quiet>Sem prazos finais na próxima semana.</Quiet>}
        </section>

        <section className="card p-5 md:p-6 lg:col-span-2" aria-label="Equipe The Bold">
          <SectionHead title="Equipe The Bold" to="/the-bold" />
          {s.team.length ? <ul className="divide-y divide-line">{[...s.team].sort(attentionSort).slice(0, 6).map(t => <MiniTask key={t.id} task={t} />)}</ul>
            : <Quiet>Nenhuma pendência da equipe em aberto.</Quiet>}
        </section>

        <section className="card p-5 md:p-6" aria-label="Aguardando retorno">
          <SectionHead title="Aguardando retorno" to="/aguardando" />
          {s.waiting.length ? <ul className="divide-y divide-line">{s.waiting.slice(0, 6).map(t => <MiniTask key={t.id} task={t} />)}</ul>
            : <Quiet>Nada dependendo de terceiros.</Quiet>}
        </section>
      </div>
    </div>
  )
}

type Tone = 'brand' | 'late' | 'ok' | 'wait' | 'soft'
const TONE: Record<Tone, string> = {
  brand: 'bg-bordo text-off [&_.k-label]:text-off/75',
  late: 'bg-late-50 text-late [&_.k-label]:text-late/80',
  ok: 'bg-ok-50 text-ok [&_.k-label]:text-ok/80',
  wait: 'bg-wait-50 text-wait [&_.k-label]:text-wait/80',
  soft: 'bg-bordo-50 text-bordo [&_.k-label]:text-bordo/75',
}
function Kpi({ label, value, to, tone, testid }: { label: string; value: number; to: string; tone?: Tone; testid?: string }) {
  return (
    <Link to={to} data-testid={testid ?? `kpi-${label}`} className={`group relative p-4 transition-all duration-200 hover:brightness-[.97] md:p-5 ${tone ? TONE[tone] : 'bg-paper text-ink hover:bg-off/60'}`}>
      <div className="num text-[2.1rem] font-light leading-none md:text-[2.4rem]">{value}</div>
      <div className="k-label mt-2 text-[12px] leading-tight text-mute">{label}</div>
      <ArrowRight size={13} className="absolute right-3 top-3 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-60" />
    </Link>
  )
}

function SectionHead({ title, to, right }: { title: string; to?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="font-serif text-[1.6rem] leading-none">{title}</h2>
      {right}
      {to && <Link to={to} className="shrink-0 text-xs text-mute transition hover:text-bordo">Ver tudo →</Link>}
    </div>
  )
}

function Quiet({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-sm text-mute">{children}</p>
}

function ByDay() {
  const { tasks, me, isMine } = useWs()
  const [scope, setScope] = useState<'mine' | 'all'>(() => (localStorage.getItem('bt_day_scope') as 'mine' | 'all') || 'mine')
  const today = todayISO()
  const days = [0, 1, 2, 3, 4].map(n => addDaysISO(today, n))
  const [sel, setSel] = useState(today)
  const pool = tasks.filter(t => !t.needs_triage && t.scheduled_date && (scope === 'all' || isMine(t, me.id)))
  const col = (d: string) => pool
    .filter(t => t.scheduled_date === d && (t.status !== 'concluida' || (d === today && t.completed_at && todayISO(new Date(t.completed_at)) === today)))
    .sort((a, b) => (a.status === 'concluida' ? 1 : 0) - (b.status === 'concluida' ? 1 : 0) || dayCmp(a, b))
  const later = pool.filter(t => isOpen(t) && t.scheduled_date! > days[4]).length
  const items = col(sel)
  return (
    <section className="card p-5 md:p-6 lg:col-span-2" aria-label="Minhas prioridades" data-testid="by-day">
      <SectionHead title={scope === 'mine' ? 'Minhas prioridades' : 'Prioridades de todas'} to="/minhas" right={
        <div className="ml-auto inline-flex rounded-full border border-line bg-off p-0.5 text-xs" role="group" aria-label="Escopo">
          {(['mine', 'all'] as const).map(v => (
            <button key={v} aria-pressed={scope === v} onClick={() => { setScope(v); localStorage.setItem('bt_day_scope', v) }}
              className={`rounded-full px-3 py-1 transition ${scope === v ? 'bg-paper font-medium shadow-sm' : 'text-mute hover:text-ink'}`}>{v === 'mine' ? 'Minhas' : 'Todas'}</button>
          ))}
        </div>} />
      <div className="scrollbar-thin -mx-1 mb-2 flex overflow-x-auto px-1" role="tablist" aria-label="Dias">
        {days.map(d => {
          const list = col(d)
          const open = list.filter(isOpen).length
          const hasPassed = list.some(isTimePassed)
          const active = sel === d
          return (
            <button key={d} role="tab" aria-selected={active} onClick={() => setSel(d)} data-testid={`day-tab-${d}`}
              className={`group relative shrink-0 border-b-2 px-4 pt-2 pb-3 text-left transition-colors first:pl-0 ${active ? 'border-bordo' : 'border-transparent hover:border-line'}`}>
              <div className={`meta text-[10px] uppercase tracking-[.18em] ${active ? 'text-bordo' : 'text-mute'}`}>{dayLabel(d)}</div>
              <div className={`num flex items-center gap-1.5 text-[1.9rem] font-light leading-tight ${active ? 'text-ink' : 'text-ink/45 group-hover:text-ink/70'}`}>
                {open}{hasPassed && <span className="h-1.5 w-1.5 rounded-full bg-late" title="Horário passou" />}
              </div>
            </button>
          )
        })}
      </div>
      {items.length
        ? <ul className="divide-y divide-line" data-testid="by-day-list">{items.map(t => <MiniTask key={t.id} task={t} showDay={false} />)}</ul>
        : <div><Quiet>{sel === today ? 'Nada para hoje. Aproveite para adiantar o que vem a seguir.' : 'Nada planejado para este dia.'}</Quiet></div>}
      <p className="meta mt-3 text-[10.5px] uppercase tracking-[.14em] text-mute">Não concluídas passam automaticamente para o dia seguinte{later > 0 && ` · ${later} planejada(s) mais adiante`}</p>
    </section>
  )
}
