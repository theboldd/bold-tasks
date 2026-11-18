import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { formatDue, initials, isOverdue, statusLabel, priorityLabel } from '../lib/labels'
import type { Member, Task } from '../lib/types'

const AV_COLORS = ['bg-bordo text-off', 'bg-ink text-off', 'bg-[#85817D] text-white', 'bg-[#6b4a3a] text-white']
export function memberColorIndex(members: Member[], id: string | null) {
  const i = members.findIndex(m => m.user_id === id)
  return i < 0 ? 2 : i % AV_COLORS.length
}
export function Avatar({ name, idx = 0, size = 28, title }: { name: string; idx?: number; size?: number; title?: string }) {
  return (
    <span title={title ?? name} className={`inline-flex items-center justify-center rounded-full font-semibold shrink-0 ${AV_COLORS[idx]}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}>{initials(name)}</span>
  )
}

const STATUS_STYLE: Record<string, string> = {
  a_fazer: 'bg-off text-ink border-line',
  em_andamento: 'bg-bordo-50 text-bordo border-[#e5d3ce]',
  aguardando: 'bg-wait-50 text-wait border-[#e8dcc3]',
  concluida: 'bg-ok-50 text-ok border-[#d4dfce]',
}
export function StatusPill({ status }: { status: string }) {
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[status]}`}>{statusLabel(status)}</span>
}
export function PriorityTag({ priority }: { priority: string }) {
  if (priority === 'normal') return null
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider ${priority === 'alta' ? 'text-bordo' : 'text-mute'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${priority === 'alta' ? 'bg-bordo' : 'bg-mute/60'}`} />{priorityLabel(priority)}
    </span>
  )
}
export function DueBadge({ task }: { task: Task }) {
  const late = isOverdue(task)
  if (!task.due_date) return <span className="text-xs text-mute/80">Sem prazo</span>
  return (
    <span className={`text-xs font-medium ${late ? 'text-late' : task.status === 'concluida' ? 'text-mute' : 'text-ink'}`}>
      {late && <span className="mr-1 rounded bg-late-50 px-1.5 py-0.5 text-[10px] uppercase tracking-wider">Atrasada</span>}
      {formatDue(task.due_date)}
    </span>
  )
}
export function TriageBadge() {
  return <span className="rounded bg-wait-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-wait">A classificar</span>
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
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-ink/30 fade-in" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`w-full ${wide ? 'md:max-w-2xl' : 'md:max-w-lg'} max-h-[92vh] overflow-y-auto rounded-t-3xl md:rounded-3xl bg-paper p-5 md:p-7 shadow-2xl`} onMouseDown={e => e.stopPropagation()}>
        {title && (
          <div className="mb-5 flex items-start justify-between gap-4">
            <h2 className="font-serif text-2xl leading-tight">{title}</h2>
            <button className="btn-text rounded-full" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

export function PageHeader({ eyebrow, title, accent, children }: { eyebrow?: string; title: string; accent?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
      <div>
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        <h1 className="font-serif text-3xl md:text-[2.6rem] leading-[1.05] tracking-tight">
          {title}{accent && <> <span className="font-accent italic font-normal text-bordo">{accent}</span></>}
        </h1>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

export function Empty({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="font-accent italic text-2xl text-bordo mb-1">{title}</div>
      {text && <p className="text-sm text-mute max-w-sm">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Spinner({ label = 'Carregando' }: { label?: string }) {
  return (
    <div className="flex h-full min-h-[40vh] items-center justify-center text-mute text-sm gap-3">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-bordo" />{label}…
    </div>
  )
}
