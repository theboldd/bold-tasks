import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { dayLabel, formatDue, initials, isOverdue, isTimePassed, statusLabel, priorityLabel, timeLabel } from '../lib/labels'
import type { Member, Task } from '../lib/types'

const AV_COLORS = ['bg-bordo text-off', 'bg-ink text-off', 'bg-mute text-white', 'bg-bordo-600 text-off']
export function memberColorIndex(members: Member[], id: string | null) {
  const i = members.findIndex(m => m.user_id === id)
  return i < 0 ? 2 : i % AV_COLORS.length
}
export function Avatar({ name, idx = 0, size = 28, title }: { name: string; idx?: number; size?: number; title?: string }) {
  return (
    <span title={title ?? name} className={`meta inline-flex items-center justify-center rounded-full font-semibold tracking-wide shrink-0 ${AV_COLORS[idx]}`}
      style={{ width: size, height: size, fontSize: size * 0.36 }}>{initials(name)}</span>
  )
}

const STATUS_DOT: Record<string, string> = {
  a_fazer: 'bg-transparent border border-mute',
  em_andamento: 'bg-bordo',
  aguardando: 'bg-wait',
  concluida: 'bg-ok',
}
export function StatusPill({ status }: { status: string }) {
  return <span className="meta inline-flex items-center gap-1.5 text-[11px] font-medium text-ink/80"><span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} />{statusLabel(status)}</span>
}
export function PriorityTag({ priority }: { priority: string }) {
  if (priority === 'normal') return null
  return (
    <span className={`meta inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[.14em] ${priority === 'alta' ? 'text-bordo' : 'text-mute'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${priority === 'alta' ? 'bg-bordo' : 'bg-mute/60'}`} />{priorityLabel(priority)}
    </span>
  )
}
export function DueBadge({ task }: { task: Task }) {
  const late = isOverdue(task)
  if (!task.due_date) return <span className="text-xs text-mute/80">Sem prazo</span>
  return (
    <span className={`text-xs font-medium ${late ? 'text-late' : task.status === 'concluida' ? 'text-mute' : 'text-ink'}`}>
      {late && <span className="mr-1 uppercase tracking-[.14em] text-[10px]">Atrasada ·</span>}
      {formatDue(task.due_date)}
    </span>
  )
}
export function TriageBadge() {
  return <span className="meta border border-wait/40 px-1.5 py-px text-[9.5px] font-semibold uppercase tracking-[.14em] text-wait">A classificar</span>
}

export function Modal({ open, onClose, children, title, wide }: { open: boolean; onClose: () => void; children: ReactNode; title?: string; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-ink/40 backdrop-blur-[2px] fade-in" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`rise-in w-full ${wide ? 'md:max-w-2xl' : 'md:max-w-xl'} max-h-[92vh] overflow-y-auto rounded-t-lg md:rounded-sm bg-paper shadow-[0_30px_80px_-30px_rgba(21,19,19,.45)]`} onMouseDown={e => e.stopPropagation()}>
        {title && (
          <div className="flex items-end justify-between gap-4 border-b border-line px-6 pt-6 pb-4 md:px-8">
            <div>
              <div className="eyebrow mb-1">BOLD TASKS</div>
              <h2 className="display text-[2rem]">{title}</h2>
            </div>
            <button className="btn-text" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
          </div>
        )}
        <div className="px-6 pt-5 pb-6 md:px-8">
        {children}
        </div>
      </div>
    </div>
  )
}

export function PageHeader({ eyebrow, title, accent, children, lede }: { eyebrow?: string; title: string; accent?: string; children?: ReactNode; lede?: ReactNode }) {
  return (
    <header className="mb-6 md:mb-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          {eyebrow && <div className="eyebrow mb-3">{eyebrow}</div>}
          <h1 className="display text-[2.6rem] md:text-[3.6rem]">
            {title}{accent && <> <em className="font-normal italic text-bordo">{accent}</em></>}
          </h1>
          {lede && <p className="mt-3 max-w-xl text-[15px] text-mute">{lede}</p>}
        </div>
        {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
      </div>
      <div className="rule-ink mt-6" />
    </header>
  )
}

/** Cabeçalho de seção editorial: "01 — Título" */
export function SectionTitle({ n, title, to, right }: { n?: string; title: string; to?: string; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3 border-b border-line pb-2.5">
      <h2 className="flex items-baseline gap-3">
        {n && <span className="meta text-[11px] font-semibold tracking-[.18em] text-bordo">{n}</span>}
        <span className="font-serif text-[1.55rem] leading-none">{title}</span>
      </h2>
      <div className="flex items-center gap-3">
        {right}
        {to && <Link to={to} className="meta link-edit text-[10.5px] uppercase tracking-[.18em] text-mute hover:text-ink">Ver tudo</Link>}
      </div>
    </div>
  )
}

export function Empty({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center border-y border-line px-6 py-16 text-center">
      <div className="meta mb-3 text-[10px] uppercase tracking-[.3em] text-mute">— nada pendente —</div>
      <div className="display mb-2 text-3xl italic text-bordo">{title}</div>
      {text && <p className="max-w-sm text-sm text-mute">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Spinner({ label = 'Carregando' }: { label?: string }) {
  return (
    <div className="py-6" role="status" aria-label={label}>
      <div className="skel mb-3 h-3 w-28" />
      <div className="skel mb-8 h-12 w-2/3 max-w-lg" />
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} className="flex items-center gap-4 border-b border-line py-4">
          <div className="skel h-5 w-5 rounded-full" />
          <div className="flex-1"><div className="skel mb-2 h-3.5" style={{ width: `${70 - i * 8}%` }} /><div className="skel h-2.5 w-40" /></div>
          <div className="skel h-6 w-6 rounded-full" />
        </div>
      ))}
    </div>
  )
}

/** Dia para fazer + horário ("Hoje · até 15h") */
export function DayTimeChip({ task, showDay = true }: { task: Task; showDay?: boolean }) {
  if (task.needs_triage) return null
  const tl = timeLabel(task)
  const passed = isTimePassed(task)
  if (!showDay && !tl) return null
  return (
    <span className={`meta inline-flex items-center gap-1 whitespace-nowrap text-[11.5px] ${passed ? 'text-late font-semibold' : 'text-ink/75'}`} title={passed ? 'O horário passou' : undefined}>
      {showDay && <span>{dayLabel(task.scheduled_date)}</span>}
      {showDay && tl && <span className="text-mute">·</span>}
      {tl && <span>{tl}</span>}
    </span>
  )
}
export function RolloverBadge({ task }: { task: Task }) {
  if (!task.rollover_count || task.status === 'concluida') return null
  return <span title={`Transferida automaticamente ${task.rollover_count} vez(es)`} className="meta text-[10.5px] font-semibold text-wait">↻ {task.rollover_count}</span>
}
export function SharedAvatars({ members, parts }: { members: Member[]; parts: { user_id: string; completed_at: string | null }[] }) {
  return (
    <span className="inline-flex -space-x-1.5" title="Pendência das duas">
      {members.map((m, i) => {
        const done = parts.find(p => p.user_id === m.user_id)?.completed_at
        return (
          <span key={m.user_id} className={`relative rounded-full ring-2 ring-paper ${done ? 'opacity-50' : ''}`}>
            <Avatar name={m.profile.name} idx={i % 4} size={24} title={`${m.profile.name}${done ? ' — parte concluída' : ' — falta concluir'}`} />
            {done && <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-ok text-[8px] text-white">✓</span>}
          </span>
        )
      })}
    </span>
  )
}
export function DeadlineBadge({ task }: { task: Task }) {
  if (!task.due_date) return null
  const late = isOverdue(task)
  return <span className={`meta text-[11px] ${late ? 'font-semibold text-late' : 'text-mute'}`}>{late ? 'Atrasada · ' : 'Prazo '}{formatDue(task.due_date)}</span>
}
