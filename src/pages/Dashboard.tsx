import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Plus, Zap } from 'lucide-react'
import { useWs } from '../lib/store'
import { useUI } from '../lib/ui'
import { PRIORITY_RANK, addDaysISO, dayLabel, firstName, isDueToday, isForToday, isOpen, isOverdue, isTimePassed, todayISO, weekStartISO } from '../lib/labels'
import { dayCmp } from '../lib/filters'
import type { Task } from '../lib/types'
import { MiniTask } from '../components/TaskViews'
import { SectionTitle, Spinner } from '../components/ui'

function attentionSort(a: Task, b: Task) {
  const today = todayISO()
  const score = (t: Task) => (isOverdue(t, today) ? 0 : isForToday(t, today) || isDueToday(t, today) ? 1 : t.priority === 'alta' ? 2 : t.status === 'em_andamento' ? 3 : 4)
  return score(a) - score(b) || dayCmp(a, b) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
}

export function Dashboard() {
  const { me, other, members, tasks, tasksLoaded, isMine, partsOf } = useWs()
  const { openNew } = useUI()
  const today = todayISO()

  const s = useMemo(() => {
    const open = tasks.filter(isOpen)
    const ws = weekStartISO(today)
    const myPartDone = (t: Task) => t.is_shared && !!partsOf(t.id).find(p => p.user_id === me.id)?.completed_at
    return {
      open,
      // indicadores pessoais: só as minhas + as juntas em que minha parte ainda falta
      myOpen: open.filter(t => isMine(t, me.id) && !myPartDone(t)),
      myOverdue: open.filter(t => isMine(t, me.id) && !myPartDone(t) && isOverdue(t, today)),
      myDoneWeek: tasks.filter(t => isMine(t, me.id) && (t.is_shared
        ? (() => { const at = partsOf(t.id).find(p => p.user_id === me.id)?.completed_at; return !!at && todayISO(new Date(at)) >= ws })()
        : t.status === 'concluida' && !!t.completed_at && todayISO(new Date(t.completed_at)) >= ws)).length,
      mine: open.filter(t => isMine(t, me.id)),
      other: other ? open.filter(t => isMine(t, other.user_id)) : [],
      overdue: open.filter(t => isOverdue(t, today)),
      myToday: open.filter(t => isForToday(t, today) && isMine(t, me.id) && !myPartDone(t)),
      waiting: open.filter(t => t.status === 'aguardando'),
      triage: open.filter(t => t.needs_triage),
      doneWeek: tasks.filter(t => t.status === 'concluida' && t.completed_at && todayISO(new Date(t.completed_at)) >= ws).length,
      upcoming: open.filter(t => t.due_date && t.due_date >= today && t.due_date <= addDaysISO(today, 7)).sort((a, b) => a.due_date!.localeCompare(b.due_date!)),
      perMember: members.map(m => ({ m, n: open.filter(t => isMine(t, m.user_id)).length })),
    }
  }, [tasks, me.id, other, members, today, isMine, partsOf])

  if (!tasksLoaded) return <Spinner />

  const hour = Number(new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hour12: false, timeZone: 'America/Sao_Paulo' }).format(new Date()))
  const greet = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
  const otherName = other ? firstName(other.profile.name) : 'equipe'
  const dateStr = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' }).format(new Date())
  const rolled = s.myToday.filter(t => t.rollover_count > 0).length
  const passed = s.myToday.filter(isTimePassed).length
  const maxMember = Math.max(1, ...s.perMember.map(x => x.n))

  return (
    <div className="rise-in">
      {/* ===== Abertura editorial ===== */}
      <div className="flex items-center justify-between gap-4 border-b border-ink pb-3">
        <div className="eyebrow text-ink">BOLD TASKS <span className="mx-2 text-mute">·</span><span className="text-mute">Central de execução</span></div>
        <div className="eyebrow hidden first-letter:uppercase sm:block">{dateStr}</div>
      </div>

      <section className="grid grid-cols-1 gap-8 pt-8 pb-10 md:pt-12 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-8">
          <p className="mb-4 font-serif text-[1.4rem] text-ink">{greet}, <em className="italic text-bordo">{firstName(me.name)}</em>.</p>
          <h1 className="display text-[3rem] sm:text-[4.2rem] lg:text-[5.4rem]">O que precisa acontecer <em className="font-normal italic text-bordo">hoje?</em></h1>
          <p className="mt-6 max-w-2xl text-[16px] leading-relaxed text-ink/75" data-testid="summary">
            {s.myToday.length
              ? <>Você tem <strong className="font-semibold text-ink">{s.myToday.length} {s.myToday.length === 1 ? 'pendência' : 'pendências'}</strong> para hoje
                  {rolled > 0 && <>, {rolled} {rolled === 1 ? 'veio' : 'vieram'} de dias anteriores</>}
                  {passed > 0 && <>, <span className="text-late">{passed} já {passed === 1 ? 'passou' : 'passaram'} do horário</span></>}.
                  {' '}O que não for concluído hoje passa para amanhã automaticamente.</>
              : <>Seu dia está livre. {s.myOpen.length ? `Você tem ${s.myOpen.length} ${s.myOpen.length === 1 ? 'pendência aberta' : 'pendências abertas'} em outros dias. Bom momento para adiantar.` : 'Nenhuma pendência sua em aberto.'}</>}
          </p>
          {(s.myOverdue.length > 0 || s.triage.length > 0) && (
            <div className="mt-6 flex flex-col items-start gap-2 text-[14px]">
              {s.myOverdue.length > 0 && <Link to="/minhas?overdue=1" className="group inline-flex items-center gap-2 border-l-2 border-late pl-3 text-late"><span><strong>{s.myOverdue.length}</strong> com prazo final vencido</span><ArrowRight size={14} className="transition group-hover:translate-x-0.5" /></Link>}
              {s.triage.length > 0 && <Link to="/a-classificar" className="group inline-flex items-center gap-2 border-l-2 border-wait pl-3 text-wait"><span><strong>{s.triage.length}</strong> captura(s) aguardando classificação</span><ArrowRight size={14} className="transition group-hover:translate-x-0.5" /></Link>}
            </div>
          )}
        </div>
        <aside className="flex flex-col justify-end gap-2 lg:col-span-4 lg:border-l lg:border-line lg:pl-10">
          <div className="eyebrow mb-2 hidden lg:block">Ações rápidas</div>
          <button className="btn btn-primary w-full py-3" onClick={() => openNew()}><Plus size={15} strokeWidth={1.8} />Nova pendência</button>
          <button className="btn btn-ghost w-full py-3" onClick={() => openNew({ mode: 'quick' })}><Zap size={14} strokeWidth={1.6} />Captura rápida</button>
          {other && <button className="btn btn-text w-full" onClick={() => openNew({ assigned_to: other.user_id })}>Atribuir para {otherName} →</button>}
        </aside>
      </section>

      {/* ===== Indicadores ===== */}
      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <Kpi to="/minhas" label="Minhas pendências" value={s.myOpen.length} tone="brand" hint={s.myToday.length ? `${s.myToday.length} para hoje` : 'nada para hoje'} testid="kpi-Abertas" />
        <Kpi to="/minhas?overdue=1" label="Atrasadas" value={s.myOverdue.length} tone={s.myOverdue.length ? 'late' : 'calm'} hint={s.myOverdue.length ? 'prazo final vencido' : 'tudo em dia'} testid="kpi-Atrasadas" />
        <Kpi to="/minhas?status=concluida&sort=created" label="Concluídas na semana" value={s.myDoneWeek} tone="ok" hint="desde segunda" testid="kpi-Concluídas na semana" />
        <div className="col-span-2 rounded-sm border border-line bg-paper px-5 py-5 md:col-span-1" data-testid="kpi-responsavel">
          <div className="eyebrow mb-3">Por responsável</div>
          <ul className="space-y-2.5">
            {s.perMember.map(({ m, n }) => (
              <li key={m.user_id}>
                <Link to={m.user_id === me.id ? '/minhas' : '/outra'} className="group flex items-center gap-3">
                  <span className="w-16 truncate text-[13px] group-hover:text-bordo">{firstName(m.profile.name)}</span>
                  <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-line"><span className="absolute inset-y-0 left-0 rounded-full bg-bordo transition-all duration-500" style={{ width: `${(n / maxMember) * 100}%` }} /></span>
                  <span className="num w-6 text-right text-[15px] font-medium">{n}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ===== Corpo editorial ===== */}
      <div className="mt-12 grid grid-cols-1 gap-x-10 gap-y-12 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8"><ByDay /></div>

        <section className="min-w-0 lg:col-span-4" aria-label="Aguardando retorno">
          <SectionTitle n="02" title="Aguardando retorno" to="/aguardando" />
          {s.waiting.length
            ? <ul className="divide-y divide-line">{s.waiting.slice(0, 6).map(t => <MiniTask key={t.id} task={t} />)}</ul>
            : <Quiet>Nada dependendo de terceiros.</Quiet>}
        </section>

        <section className="min-w-0 lg:col-span-4" aria-label="Minhas pendências">
          <SectionTitle n="03" title="Minhas pendências" to="/minhas" />
          {s.mine.length ? <ul className="divide-y divide-line">{[...s.mine].sort(attentionSort).slice(0, 6).map(t => <MiniTask key={t.id} task={t} />)}</ul>
            : <Quiet>Nenhuma pendência aberta com você.</Quiet>}
        </section>

        <section className="min-w-0 lg:col-span-4" aria-label={`Pendências da ${otherName}`}>
          <SectionTitle n="04" title={`Pendências da ${otherName}`} to="/outra" />
          {s.other.length ? <ul className="divide-y divide-line">{[...s.other].sort(attentionSort).slice(0, 6).map(t => <MiniTask key={t.id} task={t} />)}</ul>
            : <Quiet>Nenhuma pendência aberta com {otherName}.</Quiet>}
        </section>

        <section className="min-w-0 lg:col-span-4" aria-label="Próximos prazos">
          <SectionTitle n="05" title="Próximos prazos" to="/calendario" />
          {s.upcoming.length ? (
            <ol className="divide-y divide-line">
              {s.upcoming.slice(0, 6).map(t => <DeadlineRow key={t.id} task={t} />)}
            </ol>
          ) : <Quiet>Sem prazos finais nos próximos 7 dias.</Quiet>}
        </section>

      </div>
    </div>
  )
}

const KPI_TONE: Record<string, { box: string; num: string; label: string }> = {
  brand: { box: 'bg-bordo text-off border-bordo', num: 'text-off', label: 'text-off/70' },
  late: { box: 'bg-late-50 border-late/40 border-l-4 border-l-late', num: 'text-late', label: 'text-late/80' },
  ok: { box: 'bg-ok-50 border-ok/30', num: 'text-ok', label: 'text-ok/80' },
  calm: { box: 'bg-paper border-line', num: 'text-ink', label: 'text-mute' },
}
function Kpi({ label, value, to, tone = 'calm', hint, testid }: { label: string; value: number; to: string; tone?: string; hint?: string; testid: string }) {
  const t = KPI_TONE[tone] ?? KPI_TONE.calm
  return (
    <Link to={to} data-testid={testid} className={`group relative overflow-hidden rounded-sm border px-5 py-5 shadow-[0_10px_30px_-22px_rgba(21,19,19,.45)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_34px_-20px_rgba(21,19,19,.5)] ${t.box}`}>
      <div className={`eyebrow mb-2 ${t.label}`}>{label}</div>
      <div className={`num text-[2.9rem] font-light leading-none md:text-[3.4rem] ${t.num}`}>{value}</div>
      {hint && <div className={`meta mt-2 text-[11px] ${t.label}`}>{hint}</div>}
      <ArrowRight size={15} className={`absolute right-4 top-4 opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-70 ${t.num}`} />
    </Link>
  )
}

function Quiet({ children }: { children: React.ReactNode }) {
  return <p className="py-6 font-serif text-[1.15rem] italic text-mute">{children}</p>
}

function DeadlineRow({ task }: { task: Task }) {
  const { openTask } = useUI()
  const [, m, d] = task.due_date!.split('-')
  return (
    <li className="group flex cursor-pointer items-center gap-4 py-3" onClick={() => openTask(task.id)}>
      <div className="w-11 shrink-0 text-center">
        <div className="num text-[1.45rem] font-medium leading-none text-bordo">{d}</div>
        <div className="meta text-[9.5px] uppercase tracking-[.16em] text-mute">{['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][Number(m) - 1]}</div>
      </div>
      <div className="min-w-0 flex-1 border-l border-line pl-4">
        <div className="truncate text-[14px] transition-colors group-hover:text-bordo">{task.title}</div>
        <div className="meta text-[11px] text-mute">{dayLabel(task.due_date)}{task.is_shared ? ' · das duas' : ''}</div>
      </div>
    </li>
  )
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
    <section aria-label="Por dia" data-testid="by-day">
      <SectionTitle n="01" title="Prioridades do dia" right={
        <div className="meta flex items-center gap-3 text-[10.5px] uppercase tracking-[.16em]" role="group" aria-label="Escopo">
          {(['mine', 'all'] as const).map(v => (
            <button key={v} aria-pressed={scope === v} onClick={() => { setScope(v); localStorage.setItem('bt_day_scope', v) }}
              className={`pb-0.5 transition ${scope === v ? 'border-b border-ink text-ink' : 'text-mute hover:text-ink'}`}>{v === 'mine' ? 'Minhas' : 'Todas'}</button>
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
        ? <ul className="divide-y divide-line border-t border-line" data-testid="by-day-list">{items.map(t => <MiniTask key={t.id} task={t} showDay={false} />)}</ul>
        : <div className="border-t border-line"><Quiet>{sel === today ? 'Nada para hoje. Aproveite para adiantar o que vem a seguir.' : 'Nada planejado para este dia.'}</Quiet></div>}
      <p className="meta mt-3 text-[10.5px] uppercase tracking-[.14em] text-mute">Não concluídas passam automaticamente para o dia seguinte{later > 0 && ` · ${later} planejada(s) mais adiante`}</p>
    </section>
  )
}
