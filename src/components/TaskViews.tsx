import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { useWs } from '../lib/store'
import { STATUS, isOverdue, isTimePassed } from '../lib/labels'
import { categoryLabel } from '../lib/filters'
import type { Status, Task } from '../lib/types'
import { Avatar, DayTimeChip, DeadlineBadge, PriorityTag, RolloverBadge, SharedAvatars, StatusPill, TriageBadge, memberColorIndex } from './ui'
import { useUI } from '../lib/ui'

export function CompleteToggle({ task }: { task: Task }) {
  const { toggleDone, partsOf, me } = useWs()
  const done = task.status === 'concluida'
  const myPart = task.is_shared ? partsOf(task.id).find(p => p.user_id === me.id) : null
  const half = task.is_shared && !done && !!myPart?.completed_at
  const [pop, setPop] = useState(false)
  const [celebrate, setCelebrate] = useState(false)
  const prev = useRef(done || half)
  useEffect(() => { if ((done || half) && !prev.current) { setPop(true); const t = setTimeout(() => setPop(false), 500); return () => clearTimeout(t) } prev.current = done || half }, [done, half])
  const label = done ? `Reabrir “${task.title}”` : task.is_shared ? (half ? `Reabrir minha parte de “${task.title}”` : `Concluir minha parte de “${task.title}”`) : `Concluir “${task.title}”`
  return (
    <button
      aria-label={label}
      title={task.needs_triage && !done ? 'Classifique a captura antes de concluir' : label.replace(/ “.*”$/, '')}
      disabled={task.needs_triage && !done}
      data-celebrate={celebrate || undefined}
      onClick={e => {
        e.stopPropagation()
        if (celebrate) return
        if (done || half) { toggleDone(task); return }
        // efeito verde na hora do check; a pendência sai da lista logo depois
        setCelebrate(true)
        setTimeout(() => { toggleDone(task); setTimeout(() => setCelebrate(false), 300) }, 650)
      }}
      className={`group/chk relative -m-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full disabled:opacity-40`}>
      <span className={`relative flex h-[22px] w-[22px] items-center justify-center rounded-full border-[1.5px] transition-all duration-200 ${pop || celebrate ? 'done-pop' : ''} ${done || celebrate ? 'border-ok bg-ok text-off' : half ? 'border-ok bg-ok-50 text-ok' : 'border-mute/50 bg-transparent text-transparent group-hover/chk:border-ok group-hover/chk:bg-ok-50 group-hover/chk:text-ok'}`}>
        {celebrate && <span aria-hidden className="done-ring absolute inset-0 rounded-full border-2 border-ok" />}
        <Check size={13} strokeWidth={2.8} className={done || half || celebrate ? '' : 'opacity-0 transition-opacity group-hover/chk:opacity-100'} />
      </span>
    </button>
  )
}

function Who({ task, size = 26 }: { task: Task; size?: number }) {
  const { members, memberName, partsOf } = useWs()
  const person = task.is_shared ? <SharedAvatars members={members} parts={partsOf(task.id)} />
    : task.assigned_to ? <Avatar name={memberName(task.assigned_to)} idx={memberColorIndex(members, task.assigned_to)} size={size} /> : null
  const team = task.is_team ? <TeamBadge size={size} /> : null
  if (!person && !team) return <span className="rounded-full border border-dashed border-line" style={{ width: size, height: size }} title="Sem responsável" />
  return <span className="flex shrink-0 items-center -space-x-1.5">{person}{team}</span>
}

export function TeamBadge({ size = 26 }: { size?: number }) {
  return <span title="Equipe The Bold" className="meta inline-flex shrink-0 items-center justify-center rounded-full bg-bordo font-semibold text-off ring-2 ring-off" style={{ width: size, height: size, fontSize: size * 0.36 }}>TB</span>
}

export function TaskRow({ task, showAssignee = true }: { task: Task; showAssignee?: boolean }) {
  const { memberName, updateTask } = useWs()
  const { openTask } = useUI()
  const done = task.status === 'concluida'
  return (
    <li data-testid="task-row" data-task-id={task.id} className={`group relative flex items-center gap-3 md:gap-4 border-b border-line px-1 md:px-2 py-3.5 cursor-pointer transition-colors duration-300 hover:bg-paper/70 has-[[data-celebrate]]:bg-ok-50 ${done ? 'opacity-70' : ''}`} onClick={() => openTask(task.id)}>
      <span className={`absolute left-0 top-3 bottom-3 w-px transition-colors ${isOverdueOrLate(task) ? 'bg-late' : 'bg-transparent group-hover:bg-bordo/40'}`} />
      <span className="meta hidden w-8 shrink-0 text-right text-[10.5px] tracking-wider text-mute/80 md:block">{String(task.seq).padStart(3, '0')}</span>
      <CompleteToggle task={task} />
      <div className="min-w-0 flex-1">
        <button type="button" data-testid="task-title" onClick={e => { e.stopPropagation(); openTask(task.id) }} className={`block max-w-full truncate text-left text-[15px] transition-colors group-has-[[data-celebrate]]:text-ok group-has-[[data-celebrate]]:line-through ${done ? 'text-mute line-through decoration-1' : 'group-hover:text-bordo'}`}>{task.title}</button>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-mute">
          {task.needs_triage ? <TriageBadge /> : <DayTimeChip task={task} />}
          <RolloverBadge task={task} />
          <PriorityTag priority={task.priority} />
          <DeadlineBadge task={task} />
          {!task.needs_triage && <span className="meta hidden text-[11px] lg:inline">{categoryLabel(task, memberName)}</span>}
          {task.is_shared && <span className="meta text-[9.5px] font-semibold uppercase tracking-[.16em] text-bordo">Das duas</span>}
          {task.is_team && <span className="meta bg-bordo px-1.5 py-px text-[9px] font-semibold uppercase tracking-[.16em] text-off">The Bold</span>}
        </div>
      </div>
      {/* edição rápida (desktop) */}
      <div className="hidden md:flex items-center gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100" onClick={e => e.stopPropagation()}>
        <select aria-label="Status" className="meta border-b border-transparent bg-transparent px-1 py-1 text-[11.5px] hover:border-line focus:border-ink outline-none"
          value={task.status} disabled={task.needs_triage} onChange={e => updateTask(task.id, { status: e.target.value as Status })}>
          {STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        {!task.needs_triage && <input aria-label="Dia para fazer" title="Dia para fazer" type="date" className="meta w-[124px] border-b border-transparent bg-transparent px-1 py-1 text-[11.5px] hover:border-line focus:border-ink outline-none"
          value={task.scheduled_date ?? ''} onChange={e => e.target.value && updateTask(task.id, { scheduled_date: e.target.value })} />}
      </div>
      {(showAssignee || task.is_shared || task.is_team) && <Who task={task} />}
    </li>
  )
}

export function TaskList({ tasks, showAssignee = true, empty }: { tasks: Task[]; showAssignee?: boolean; empty?: React.ReactNode }) {
  if (!tasks.length) return <>{empty}</>
  return <ul className="border-t border-ink/80">{tasks.map(t => <TaskRow key={t.id} task={t} showAssignee={showAssignee} />)}</ul>
}

export function Kanban({ tasks }: { tasks: Task[] }) {
  const { memberName, updateTask } = useWs()
  const { openTask } = useUI()
  const [over, setOver] = useState<Status | null>(null)
  return (
    <div className="scrollbar-thin -mx-4 md:mx-0 flex gap-4 overflow-x-auto px-4 md:px-0 pb-4 snap-x">
      {STATUS.map(col => {
        const items = tasks.filter(t => t.status === col.value)
        return (
          <section key={col.value} data-testid={`kanban-${col.value}`} aria-label={col.label}
            className={`snap-start flex w-[82vw] sm:w-[290px] shrink-0 flex-col border-t-2 pt-3 transition-colors ${over === col.value ? 'border-bordo bg-bordo-50/50' : col.value === 'concluida' ? 'border-ok' : col.value === 'em_andamento' ? 'border-bordo' : col.value === 'aguardando' ? 'border-wait' : 'border-ink'}`}
            onDragOver={e => { e.preventDefault(); setOver(col.value) }}
            onDragLeave={() => setOver(null)}
            onDrop={e => {
              e.preventDefault(); setOver(null)
              const id = e.dataTransfer.getData('text/task')
              const t = tasks.find(x => x.id === id)
              if (t && t.status !== col.value && !t.needs_triage) updateTask(id, { status: col.value })
            }}>
            <header className="mb-3 flex items-baseline justify-between px-0.5">
              <h3 className="font-serif text-[1.45rem] leading-none">{col.label}</h3>
              <span className="num text-[13px] text-mute">{String(items.length).padStart(2, '0')}</span>
            </header>
            <div className="flex min-h-24 flex-col gap-2 pb-2">
              {items.map(t => (
                <article key={t.id} data-testid="kanban-card" data-task-id={t.id} draggable
                  onDragStart={e => e.dataTransfer.setData('text/task', t.id)}
                  onClick={() => openTask(t.id)}
                  className="group cursor-pointer border border-line bg-paper p-3.5 transition-all duration-300 hover:-translate-y-px hover:border-mute/40 hover:shadow-[0_8px_20px_-14px_rgba(21,19,19,.35)] has-[[data-celebrate]]:border-ok has-[[data-celebrate]]:bg-ok-50">
                  <div className="flex items-start gap-2.5">
                    <CompleteToggle task={t} />
                    <button type="button" onClick={e => { e.stopPropagation(); openTask(t.id) }} className={`text-left text-[14px] leading-snug group-has-[[data-celebrate]]:text-ok group-has-[[data-celebrate]]:line-through ${t.status === 'concluida' ? 'text-mute line-through' : 'group-hover:text-bordo'}`}>{t.title}</button>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {t.needs_triage ? <TriageBadge /> : <span className="meta text-[10.5px] text-mute">{categoryLabel(t, memberName)}</span>}
                      <PriorityTag priority={t.priority} />
                    </div>
                    <div className="flex items-center gap-2">
                      <DayTimeChip task={t} />
                      <Who task={t} size={22} />
                    </div>
                  </div>
                  {/* mudança de status no celular (sem arrastar) */}
                  <select aria-label="Mover para" onClick={e => e.stopPropagation()} className="meta mt-2 w-full border-t border-line bg-transparent px-0 pt-2 text-[11px] text-mute md:hidden"
                    value={t.status} disabled={t.needs_triage} onChange={e => updateTask(t.id, { status: e.target.value as Status })}>
                    {STATUS.map(s => <option key={s.value} value={s.value}>Mover: {s.label}</option>)}
                  </select>
                </article>
              ))}
              {!items.length && <div className="border border-dashed border-line px-3 py-8 text-center font-serif text-[15px] italic text-mute">{col.value === 'concluida' ? 'Arraste aqui para concluir. Para ver concluídas, use o filtro Status.' : 'Nada aqui'}</div>}
            </div>
          </section>
        )
      })}
    </div>
  )
}

export function MiniTask({ task, showDay = true }: { task: Task; showDay?: boolean }) {
  const { openTask } = useUI()
  return (
    <li className="group -mx-2 flex cursor-pointer items-center gap-3 px-2 py-3 transition-colors duration-300 has-[[data-celebrate]]:bg-ok-50" onClick={() => openTask(task.id)} data-testid="mini-task" data-task-id={task.id}>
      <CompleteToggle task={task} />
      <div className="min-w-0 flex-1">
        <button type="button" onClick={e => { e.stopPropagation(); openTask(task.id) }} className={`block max-w-full truncate text-left text-[14px] transition-colors group-has-[[data-celebrate]]:text-ok group-has-[[data-celebrate]]:line-through ${task.status === 'concluida' ? 'text-mute line-through' : 'group-hover:text-bordo'}`}>{task.title}</button>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-mute">
          <DayTimeChip task={task} showDay={showDay} /><RolloverBadge task={task} /><PriorityTag priority={task.priority} /><DeadlineBadge task={task} />
          {task.status !== 'a_fazer' && task.status !== 'concluida' && <StatusPill status={task.status} />}
        </div>
      </div>
      <Who task={task} size={22} />
    </li>
  )
}

const isOverdueOrLate = (t: Task) => isOverdue(t) || isTimePassed(t)
