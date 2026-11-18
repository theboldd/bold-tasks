import { useState } from 'react'
import { Check } from 'lucide-react'
import { useWs } from '../lib/store'
import { STATUS } from '../lib/labels'
import { categoryLabel } from '../lib/filters'
import type { Status, Task } from '../lib/types'
import { Avatar, DueBadge, PriorityTag, StatusPill, TriageBadge, memberColorIndex } from './ui'
import { useUI } from '../lib/ui'

export function CompleteToggle({ task }: { task: Task }) {
  const { updateTask } = useWs()
  const done = task.status === 'concluida'
  return (
    <button
      aria-label={done ? `Reabrir “${task.title}”` : `Concluir “${task.title}”`}
      title={task.needs_triage && !done ? 'Classifique a captura antes de concluir' : done ? 'Reabrir' : 'Concluir'}
      disabled={task.needs_triage && !done}
      onClick={e => { e.stopPropagation(); updateTask(task.id, { status: done ? 'a_fazer' : 'concluida' }) }}
      className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border transition disabled:opacity-40 ${done ? 'border-ok bg-ok text-white' : 'border-[#cfc7bd] bg-paper hover:border-bordo hover:bg-bordo-50'}`}>
      {done && <Check size={13} strokeWidth={3} />}
    </button>
  )
}

export function TaskRow({ task, showAssignee = true }: { task: Task; showAssignee?: boolean }) {
  const { members, memberName, updateTask } = useWs()
  const { openTask } = useUI()
  const done = task.status === 'concluida'
  return (
    <li data-testid="task-row" data-task-id={task.id} className="group flex items-center gap-3 border-b border-line px-3 md:px-4 py-3 last:border-0 hover:bg-off/60 cursor-pointer" onClick={() => openTask(task.id)}>
      <CompleteToggle task={task} />
      <div className="min-w-0 flex-1">
        <div className={`truncate text-[15px] ${done ? 'text-mute line-through decoration-1' : ''}`}>{task.title}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-mute">
          {task.needs_triage ? <TriageBadge /> : <span>{categoryLabel(task, memberName)}</span>}
          <PriorityTag priority={task.priority} />
          <span className="md:hidden"><DueBadge task={task} /></span>
          <span className="hidden sm:inline">#{task.seq}</span>
        </div>
      </div>
      {/* edição rápida (desktop) */}
      <div className="hidden md:flex items-center gap-2" onClick={e => e.stopPropagation()}>
        <select aria-label="Status" className="rounded-full border border-transparent bg-transparent px-2 py-1 text-xs hover:border-line focus:border-bordo outline-none"
          value={task.status} disabled={task.needs_triage} onChange={e => updateTask(task.id, { status: e.target.value as Status })}>
          {STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <input aria-label="Prazo" type="date" className={`w-[132px] rounded-full border border-transparent bg-transparent px-2 py-1 text-xs hover:border-line focus:border-bordo outline-none ${task.due_date ? '' : 'text-mute'}`}
          value={task.due_date ?? ''} onChange={e => updateTask(task.id, { due_date: e.target.value || null })} />
      </div>
      <div className="hidden md:block w-24 text-right"><DueBadge task={task} /></div>
      {showAssignee && (task.assigned_to
        ? <Avatar name={memberName(task.assigned_to)} idx={memberColorIndex(members, task.assigned_to)} size={26} />
        : <span className="h-[26px] w-[26px] rounded-full border border-dashed border-[#cfc7bd]" title="Sem responsável" />)}
    </li>
  )
}

export function TaskList({ tasks, showAssignee = true, empty }: { tasks: Task[]; showAssignee?: boolean; empty?: React.ReactNode }) {
  if (!tasks.length) return <>{empty}</>
  return <ul className="card overflow-hidden">{tasks.map(t => <TaskRow key={t.id} task={t} showAssignee={showAssignee} />)}</ul>
}

export function Kanban({ tasks }: { tasks: Task[] }) {
  const { members, memberName, updateTask } = useWs()
  const { openTask } = useUI()
  const [over, setOver] = useState<Status | null>(null)
  return (
    <div className="scrollbar-thin -mx-4 md:mx-0 flex gap-4 overflow-x-auto px-4 md:px-0 pb-4 snap-x">
      {STATUS.map(col => {
        const items = tasks.filter(t => t.status === col.value)
        return (
          <section key={col.value} data-testid={`kanban-${col.value}`} aria-label={col.label}
            className={`snap-start flex w-[82vw] sm:w-[300px] shrink-0 flex-col rounded-2xl border p-3 transition ${over === col.value ? 'border-bordo bg-bordo-50/60' : 'border-line bg-[#efebe5]'}`}
            onDragOver={e => { e.preventDefault(); setOver(col.value) }}
            onDragLeave={() => setOver(null)}
            onDrop={e => {
              e.preventDefault(); setOver(null)
              const id = e.dataTransfer.getData('text/task')
              const t = tasks.find(x => x.id === id)
              if (t && t.status !== col.value && !t.needs_triage) updateTask(id, { status: col.value })
            }}>
            <header className="mb-3 flex items-center justify-between px-1">
              <h3 className="font-serif text-lg">{col.label}</h3>
              <span className="text-xs text-mute">{items.length}</span>
            </header>
            <div className="flex min-h-24 flex-col gap-2">
              {items.map(t => (
                <article key={t.id} data-testid="kanban-card" data-task-id={t.id} draggable
                  onDragStart={e => e.dataTransfer.setData('text/task', t.id)}
                  onClick={() => openTask(t.id)}
                  className="cursor-pointer rounded-xl border border-line bg-paper p-3 shadow-[0_1px_0_#0000000a] hover:border-[#cfc7bd]">
                  <div className="flex items-start gap-2.5">
                    <CompleteToggle task={t} />
                    <p className={`text-sm leading-snug ${t.status === 'concluida' ? 'text-mute line-through' : ''}`}>{t.title}</p>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {t.needs_triage ? <TriageBadge /> : <span className="text-[11px] text-mute">{categoryLabel(t, memberName)}</span>}
                      <PriorityTag priority={t.priority} />
                    </div>
                    <div className="flex items-center gap-2">
                      <DueBadge task={t} />
                      {t.assigned_to && <Avatar name={memberName(t.assigned_to)} idx={memberColorIndex(members, t.assigned_to)} size={22} />}
                    </div>
                  </div>
                  {/* mudança de status no celular (sem arrastar) */}
                  <select aria-label="Mover para" onClick={e => e.stopPropagation()} className="mt-2 w-full rounded-lg border border-line bg-off px-2 py-1 text-xs md:hidden"
                    value={t.status} disabled={t.needs_triage} onChange={e => updateTask(t.id, { status: e.target.value as Status })}>
                    {STATUS.map(s => <option key={s.value} value={s.value}>Mover: {s.label}</option>)}
                  </select>
                </article>
              ))}
              {!items.length && <div className="rounded-xl border border-dashed border-[#d6cfc6] px-3 py-6 text-center text-xs text-mute">{col.value === 'concluida' ? 'Arraste aqui para concluir. Para ver concluídas, use o filtro Status.' : 'Nada aqui'}</div>}
            </div>
          </section>
        )
      })}
    </div>
  )
}

export function MiniTask({ task }: { task: Task }) {
  const { memberName, members } = useWs()
  const { openTask } = useUI()
  return (
    <li className="flex items-center gap-3 py-2.5 cursor-pointer" onClick={() => openTask(task.id)} data-testid="mini-task">
      <CompleteToggle task={task} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{task.title}</div>
        <div className="flex items-center gap-2 text-xs text-mute"><DueBadge task={task} /><PriorityTag priority={task.priority} />{task.status !== 'a_fazer' && <StatusPill status={task.status} />}</div>
      </div>
      {task.assigned_to && <Avatar name={memberName(task.assigned_to)} idx={memberColorIndex(members, task.assigned_to)} size={22} />}
    </li>
  )
}
