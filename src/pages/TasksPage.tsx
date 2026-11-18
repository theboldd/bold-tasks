import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Columns3, List, Plus, Rows3, SlidersHorizontal, X } from 'lucide-react'
import { useWs } from '../lib/store'
import { useUI } from '../lib/ui'
import { EMPTY_FILTERS, applyFilters, dayCmp, categoryOptions, filtersFromParams, filtersToParams, type Filters } from '../lib/filters'
import { PRIORITY, STATUS, firstName, isForToday, isOverdue, todayISO } from '../lib/labels'
import type { Task } from '../lib/types'
import { Kanban, TaskList } from '../components/TaskViews'
import { Empty, PageHeader, Spinner } from '../components/ui'

export type Variant = 'all' | 'mine' | 'other' | 'thebold' | 'waiting' | 'triage'

export function TasksPage({ variant }: { variant: Variant }) {
  const { tasks, tasksLoaded, me, other, members, isMine } = useWs()
  const { openNew } = useUI()
  const [params, setParams] = useSearchParams()
  const [showFilters, setShowFilters] = useState(false)

  const grouped = variant === 'mine' || variant === 'other'
  const view = params.get('view') ?? (grouped ? 'groups' : 'list')

  const scoped = useMemo(() => tasks.filter(t => {
    if (variant === 'mine') return isMine(t, me.id)
    if (variant === 'other') return !!other && isMine(t, other.user_id)
    if (variant === 'thebold') return t.is_team
    if (variant === 'waiting') return t.status === 'aguardando'
    if (variant === 'triage') return t.needs_triage && t.status !== 'concluida'
    return true
  }), [tasks, variant, me.id, other, isMine])

  // mesma base para lista e Kanban: as duas visões mostram exatamente os mesmos dados
  const base: Filters = { ...EMPTY_FILTERS, status: grouped || variant === 'waiting' ? '' : 'open' }
  const f = filtersFromParams(params, base)
  const setF = (patch: Partial<Filters>) => {
    const p = filtersToParams({ ...f, ...patch }, base, new URLSearchParams(params))
    setParams(p, { replace: true })
  }
  const setView = (v: string) => { const p = new URLSearchParams(params); p.set('view', v); setParams(p, { replace: true }) }
  const filtered = applyFilters(scoped, f)
  const activeCount = (Object.keys(base) as (keyof Filters)[]).filter(k => k !== 'sort' && k !== 'q' && f[k] !== base[k]).length

  const otherName = other ? firstName(other.profile.name) : 'equipe'
  const header = {
    all: { eyebrow: 'Central de tarefas', title: 'Todas as', accent: 'pendências' },
    mine: { eyebrow: firstName(me.name), title: 'Minhas', accent: 'pendências' },
    other: { eyebrow: 'Alinhamento e visibilidade', title: 'Pendências da', accent: otherName },
    thebold: { eyebrow: 'Pendências da equipe', title: 'Equipe', accent: 'The Bold' },
    waiting: { eyebrow: 'Dependem de retorno', title: 'Aguardando', accent: 'terceiros' },
    triage: { eyebrow: 'Capturas rápidas', title: 'A', accent: 'classificar' },
  }[variant]

  const newDefaults = variant === 'mine' ? { assigned_to: me.id } : variant === 'other' && other ? { assigned_to: other.user_id } : variant === 'thebold' ? { team: true } : variant === 'waiting' ? { status: 'aguardando' as const } : variant === 'triage' ? { mode: 'quick' as const } : undefined

  if (!tasksLoaded) return <Spinner />

  return (
    <div>
      <PageHeader {...header} lede={variant === 'other' ? 'Para acompanhar e alinhar, não para cobrar. Use os comentários de cada pendência para conversar.' : undefined}>
        <div className="inline-flex border-b border-line" role="group" aria-label="Visualização">
          {grouped && <ViewBtn active={view === 'groups'} onClick={() => setView('groups')} label="Agrupado"><Rows3 size={15} /></ViewBtn>}
          <ViewBtn active={view === 'list'} onClick={() => setView('list')} label="Lista"><List size={15} /></ViewBtn>
          <ViewBtn active={view === 'kanban'} onClick={() => setView('kanban')} label="Kanban"><Columns3 size={15} /></ViewBtn>
        </div>
        <button className="btn btn-primary" onClick={() => openNew(newDefaults)}><Plus size={15} strokeWidth={1.8} />Nova</button>
      </PageHeader>


      {/* busca + filtros */}
      <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-3">
        <input aria-label="Buscar nesta lista" className="field-line w-full max-w-xs text-[14px]" placeholder="Buscar por palavra-chave" value={f.q} onChange={e => setF({ q: e.target.value })} />
        <button className={`meta inline-flex items-center gap-2 border-b pb-1 text-[11px] uppercase tracking-[.16em] transition ${activeCount || showFilters ? 'border-ink text-ink' : 'border-transparent text-mute hover:text-ink'}`} onClick={() => setShowFilters(s => !s)} aria-expanded={showFilters} data-testid="toggle-filters">
          <SlidersHorizontal size={13} strokeWidth={1.6} />Filtros{activeCount ? ` · ${activeCount}` : ''}
        </button>
        <select aria-label="Ordenar por" className="field-line meta w-auto text-[12px]" value={f.sort} onChange={e => setF({ sort: e.target.value as Filters['sort'] })}>
          <option value="day">Ordenar: dia e horário</option>
          <option value="due">Ordenar: prazo final</option>
          <option value="priority">Ordenar: prioridade</option>
          <option value="created">Ordenar: criação</option>
        </select>
        {(activeCount > 0 || f.q) && <button className="meta inline-flex items-center gap-1 text-[11px] uppercase tracking-[.16em] text-late" onClick={() => setParams(new URLSearchParams(params.get('view') ? { view: params.get('view')! } : {}), { replace: true })}><X size={12} />Limpar</button>}
        <span className="meta ml-auto text-[11px] uppercase tracking-[.16em] text-mute" data-testid="result-count"><span className="num text-[14px] text-ink">{filtered.length}</span> {filtered.length === 1 ? 'pendência' : 'pendências'}</span>
      </div>

      {showFilters && (
        <div className="mb-6 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-line py-5 fade-in md:grid-cols-4 lg:grid-cols-7" data-testid="filters">
          <Sel label="Responsável" value={f.assigned} onChange={v => setF({ assigned: v })} disabled={grouped}
            opts={[{ value: '', label: 'Todas' }, ...members.map(m => ({ value: m.user_id, label: m.profile.name })), { value: 'shared', label: 'Das duas' }, { value: 'team', label: 'Equipe The Bold' }, { value: 'none', label: 'Sem responsável' }]} />
          <Sel label="Criado por" value={f.createdBy} onChange={v => setF({ createdBy: v })}
            opts={[{ value: '', label: 'Todas' }, ...members.map(m => ({ value: m.user_id, label: m.profile.name }))]} />
          <Sel label="Categoria" value={f.category} onChange={v => setF({ category: v })} opts={[{ value: '', label: 'Todas' }, ...categoryOptions(members)]} />
          <Sel label="Status" value={f.status} onChange={v => setF({ status: v })} opts={[{ value: '', label: 'Todos' }, { value: 'open', label: 'Abertas' }, ...STATUS]} />
          <Sel label="Prioridade" value={f.priority} onChange={v => setF({ priority: v })} opts={[{ value: '', label: 'Todas' }, ...PRIORITY]} />
          <Sel label="Dia para fazer" value={f.day} onChange={v => setF({ day: v })}
            opts={[{ value: '', label: 'Qualquer' }, { value: 'today', label: 'Hoje' }, { value: 'tomorrow', label: 'Amanhã' }, { value: 'week', label: 'Esta semana' }, { value: 'none', label: 'Sem dia' }]} />
          <Sel label="Prazo final" value={f.due} onChange={v => setF({ due: v, noDue: false })}
            opts={[{ value: '', label: 'Qualquer' }, { value: 'today', label: 'Hoje' }, { value: 'week', label: 'Esta semana' }, { value: 'next7', label: 'Próximos 7 dias' }, { value: 'month', label: 'Este mês' }]} />
          <div className="col-span-2 md:col-span-4 lg:col-span-7 flex flex-wrap gap-4 pt-1 text-sm">
            <Chk label="Só atrasadas" checked={f.overdue} onChange={v => setF({ overdue: v })} />
            <Chk label="Sem prazo final" checked={f.noDue} onChange={v => setF({ noDue: v, due: '' })} />
            <Chk label="A classificar" checked={f.triage} onChange={v => setF({ triage: v })} />
          </div>
        </div>
      )}

      {view === 'kanban' ? <Kanban tasks={filtered} />
        : view === 'groups' ? <Groups tasks={filtered} />
        : <TaskList tasks={filtered} empty={<Empty title="Nada por aqui" text={f.q || activeCount ? 'Nenhuma pendência corresponde aos filtros.' : 'Nenhuma pendência aberta nesta área.'} />} />}
    </div>
  )
}

function Groups({ tasks }: { tasks: Task[] }) {
  const today = todayISO()
  const used = new Set<string>()
  const take = (pred: (t: Task) => boolean) => tasks.filter(t => !used.has(t.id) && pred(t)).map(t => (used.add(t.id), t))
  const groups = [
    { key: 'overdue', title: 'Atrasadas', items: take(t => isOverdue(t, today)) },
    { key: 'today', title: 'Para hoje', items: take(t => isForToday(t, today)) },
    { key: 'doing', title: 'Em andamento', items: take(t => t.status === 'em_andamento') },
    { key: 'waiting', title: 'Aguardando terceiros', items: take(t => t.status === 'aguardando') },
    { key: 'next', title: 'Próximas', items: take(t => t.status !== 'concluida').sort(dayCmp) },
    { key: 'done', title: 'Concluídas', items: take(t => t.status === 'concluida').sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? '')).slice(0, 15) },
  ]
  if (!tasks.length) return <Empty title="Tudo em dia" text="Nenhuma pendência nesta área." />
  return (
    <div className="space-y-8">
      {groups.filter(g => g.items.length).map(g => (
        <section key={g.key} aria-label={g.title} data-testid={`group-${g.key}`}>
          <h2 className={`mb-2 flex items-baseline gap-3 font-serif text-[1.6rem] ${g.key === 'overdue' ? 'text-late' : ''}`}>{g.title}<span className="num text-[13px] text-mute">{String(g.items.length).padStart(2, '0')}</span></h2>
          <TaskList tasks={g.items} showAssignee={false} />
        </section>
      ))}
    </div>
  )
}

function ViewBtn({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return <button aria-pressed={active} title={label} onClick={onClick} className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] transition ${active ? 'border-bordo text-ink' : 'border-transparent text-mute hover:text-ink'}`}>{children}<span className="hidden sm:inline">{label}</span></button>
}
function Sel({ label, value, onChange, opts, disabled }: { label: string; value: string; onChange: (v: string) => void; opts: { value: string; label: string }[]; disabled?: boolean }) {
  return (
    <label className="block">
      <span className="eyebrow mb-1 block">{label}</span>
      <select aria-label={`Filtro ${label}`} className="field-line w-full text-[13px]" value={value} disabled={disabled} onChange={e => onChange(e.target.value)}>
        {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  )
}
function Chk({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <label className="inline-flex cursor-pointer items-center gap-2 text-[13px]"><input type="checkbox" className="accent-bordo h-3.5 w-3.5" checked={checked} onChange={e => onChange(e.target.checked)} />{label}</label>
}
