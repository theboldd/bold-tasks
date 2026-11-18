import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useWs } from '../lib/store'
import { useUI } from '../lib/ui'
import { MONTHS_FULL, WEEKDAYS, addDaysISO, isOverdue, todayISO, weekStartISO, firstName } from '../lib/labels'
import type { Task } from '../lib/types'
import { PageHeader, Spinner, memberColorIndex } from '../components/ui'

const DOT = ['bg-bordo', 'bg-ink', 'bg-mute', 'bg-[#6b4a3a]']
const CHIP = ['border-l-bordo', 'border-l-ink', 'border-l-mute', 'border-l-[#6b4a3a]']

export function CalendarPage() {
  const { tasks, tasksLoaded, members, updateTask } = useWs()
  const { openTask, openNew } = useUI()
  const today = todayISO()
  const [mode, setMode] = useState<'month' | 'week'>(() => (window.innerWidth < 768 ? 'week' : 'month'))
  const [anchor, setAnchor] = useState(today)
  const [who, setWho] = useState('')
  const [showDone, setShowDone] = useState(true)
  const [dragOver, setDragOver] = useState<string | null>(null)

  const byDay = useMemo(() => {
    const m = new Map<string, Task[]>()
    for (const t of tasks) {
      if (!t.due_date) continue
      if (who && t.assigned_to !== who) continue
      if (!showDone && t.status === 'concluida') continue
      const arr = m.get(t.due_date) ?? []
      arr.push(t); m.set(t.due_date, arr)
    }
    return m
  }, [tasks, who, showDone])

  const days = useMemo(() => {
    if (mode === 'week') { const s = weekStartISO(anchor); return Array.from({ length: 7 }, (_, i) => addDaysISO(s, i)) }
    const first = `${anchor.slice(0, 7)}-01`
    const s = weekStartISO(first)
    return Array.from({ length: 42 }, (_, i) => addDaysISO(s, i))
  }, [mode, anchor])

  const [y, m] = anchor.split('-').map(Number)
  const title = mode === 'month' ? `${MONTHS_FULL[m - 1]} ${y}` : (() => { const s = days[0], e = days[6]; return `${Number(s.slice(8))} ${MONTHS_FULL[Number(s.slice(5, 7)) - 1].slice(0, 3).toLowerCase()} – ${Number(e.slice(8))} ${MONTHS_FULL[Number(e.slice(5, 7)) - 1].slice(0, 3).toLowerCase()}` })()
  const move = (dir: number) => {
    if (mode === 'week') return setAnchor(addDaysISO(anchor, 7 * dir))
    const dt = new Date(Date.UTC(y, m - 1 + dir, 1)); setAnchor(dt.toISOString().slice(0, 10))
  }

  if (!tasksLoaded) return <Spinner />

  const chip = (t: Task) => (
    <button key={t.id} draggable onDragStart={e => e.dataTransfer.setData('text/task', t.id)} onClick={e => { e.stopPropagation(); openTask(t.id) }} data-testid="cal-chip"
      className={`block w-full truncate rounded-md border-l-[3px] px-1.5 py-1 text-left text-[11.5px] leading-tight ${CHIP[memberColorIndex(members, t.assigned_to)]} ${t.status === 'concluida' ? 'bg-off text-mute line-through' : isOverdue(t, today) ? 'bg-late-50 text-late font-medium' : 'bg-off hover:bg-bordo-50'}`}>
      {t.title}
    </button>
  )

  return (
    <div>
      <PageHeader eyebrow="Prazos" title="Calendário">
        <div className="inline-flex rounded-full border border-line bg-paper p-1 text-sm">
          {(['month', 'week'] as const).map(v => <button key={v} aria-pressed={mode === v} onClick={() => setMode(v)} className={`rounded-full px-3 py-1.5 ${mode === v ? 'bg-bordo text-off' : 'text-mute'}`}>{v === 'month' ? 'Mês' : 'Semana'}</button>)}
        </div>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button className="btn btn-ghost px-2.5" onClick={() => move(-1)} aria-label="Período anterior"><ChevronLeft size={16} /></button>
          <button className="btn btn-ghost" onClick={() => setAnchor(today)}>Hoje</button>
          <button className="btn btn-ghost px-2.5" onClick={() => move(1)} aria-label="Próximo período"><ChevronRight size={16} /></button>
        </div>
        <h2 className="font-serif text-2xl" data-testid="cal-title">{title}</h2>
        <div className="ml-auto flex flex-wrap items-center gap-3 text-sm">
          <button onClick={() => setWho('')} className={`rounded-full px-3 py-1 ${!who ? 'bg-ink text-off' : 'text-mute'}`}>Todas</button>
          {members.map((mb, i) => (
            <button key={mb.user_id} onClick={() => setWho(w => w === mb.user_id ? '' : mb.user_id)} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${who === mb.user_id ? 'bg-ink text-off' : 'text-ink'}`}>
              <span className={`h-2.5 w-2.5 rounded-full ${DOT[i % DOT.length]}`} />{firstName(mb.profile.name)}
            </button>
          ))}
          <label className="inline-flex items-center gap-1.5 text-mute"><input type="checkbox" className="accent-[#3A0000]" checked={showDone} onChange={e => setShowDone(e.target.checked)} />Concluídas</label>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="hidden md:grid grid-cols-7 border-b border-line bg-off/60">
          {WEEKDAYS.map(d => <div key={d} className="px-3 py-2 eyebrow">{d}</div>)}
        </div>
        <div className={`grid ${mode === 'week' ? 'grid-cols-1 md:grid-cols-7' : 'grid-cols-7'}`}>
          {days.map((d, i) => {
            const list = byDay.get(d) ?? []
            const outside = mode === 'month' && d.slice(0, 7) !== anchor.slice(0, 7)
            const isToday = d === today
            return (
              <div key={d} data-testid={`cal-day-${d}`}
                onDragOver={e => { e.preventDefault(); setDragOver(d) }} onDragLeave={() => setDragOver(null)}
                onDrop={e => { e.preventDefault(); setDragOver(null); const id = e.dataTransfer.getData('text/task'); if (id) updateTask(id, { due_date: d }) }}
                onDoubleClick={() => openNew({ due_date: d })}
                className={`group border-line ${mode === 'month' ? `min-h-[64px] md:min-h-[118px] ${i % 7 !== 6 ? 'border-r' : ''} ${i < 35 ? 'border-b' : ''}` : `min-h-[90px] md:min-h-[420px] border-b md:border-b-0 ${i !== 6 ? 'md:border-r' : ''}`} p-1.5 md:p-2 ${outside ? 'bg-off/50' : ''} ${dragOver === d ? 'bg-bordo-50' : ''}`}>
                <div className="mb-1 flex items-center justify-between">
                  <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs tabular-nums ${isToday ? 'bg-bordo text-off font-semibold' : outside ? 'text-mute/60' : 'text-ink'}`}>
                    {mode === 'week' && <span className="mr-1 md:hidden">{WEEKDAYS[i]}</span>}{Number(d.slice(8))}
                  </span>
                  <button className="hidden group-hover:inline text-mute hover:text-bordo text-sm leading-none px-1" onClick={() => openNew({ due_date: d })} aria-label={`Nova pendência em ${d}`}>+</button>
                </div>
                {/* mês no celular: só pontos */}
                {mode === 'month' && (
                  <div className="flex flex-wrap gap-1 md:hidden">
                    {list.slice(0, 6).map(t => <button key={t.id} onClick={() => openTask(t.id)} aria-label={t.title} className={`h-2 w-2 rounded-full ${isOverdue(t, today) ? 'bg-late' : DOT[memberColorIndex(members, t.assigned_to)]} ${t.status === 'concluida' ? 'opacity-30' : ''}`} />)}
                  </div>
                )}
                <div className={`space-y-1 ${mode === 'month' ? 'hidden md:block' : ''}`}>
                  {list.slice(0, mode === 'month' ? 4 : 50).map(chip)}
                  {mode === 'month' && list.length > 4 && <div className="px-1 text-[11px] text-mute">+{list.length - 4} mais</div>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <p className="mt-3 text-xs text-mute">Arraste uma pendência para outro dia para alterar o prazo. Clique duas vezes num dia para criar uma pendência com aquela data.</p>
    </div>
  )
}
