import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useWs } from '../lib/store'
import { useUI } from '../lib/ui'
import { MONTHS_FULL, WEEKDAYS, addDaysISO, effectiveTime, firstName, isOverdue, isTimePassed, timeLabel, todayISO, weekStartISO } from '../lib/labels'
import type { CalEvent, Task } from '../lib/types'
import { PageHeader, Spinner, memberColorIndex } from '../components/ui'

const DOT = ['bg-bordo', 'bg-ink', 'bg-mute', 'bg-[#6b4a3a]']
const CHIP = ['border-l-bordo', 'border-l-ink', 'border-l-mute', 'border-l-[#6b4a3a]']
const H0 = 7, H1 = 22, PX = 48 // grade: 7h às 22h, 48px por hora
const TZ = 'America/Sao_Paulo'
type Mode = 'month' | 'week' | 'day'

const spDate = (d: Date) => todayISO(d)
const spMinutes = (d: Date) => {
  const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(d).split(':').map(Number)
  return (h % 24) * 60 + m
}
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

function useCalendarEvents(from: string, to: string) {
  const [events, setEvents] = useState<CalEvent[]>([])
  const [status, setStatus] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const load = useCallback(async (refresh = false) => {
    setLoading(true)
    const { data, error } = await supabase.functions.invoke('calendar-events', { body: { from: `${from}T00:00:00-03:00`, to: `${addDaysISO(to, 1)}T00:00:00-03:00`, refresh: refresh ? '1' : undefined } })
    setLoading(false)
    if (error || !data) return
    setEvents(data.events ?? []); setStatus(data.status ?? {})
  }, [from, to])
  useEffect(() => { load(); const i = setInterval(() => load(), 5 * 60 * 1000); return () => clearInterval(i) }, [load])
  return { events, status, loading, reload: load }
}

export function CalendarPage() {
  const { tasks, tasksLoaded, members, updateTask, me } = useWs()
  const { openTask, openNew } = useUI()
  const today = todayISO()
  const [mode, setMode] = useState<Mode>(() => (window.innerWidth < 768 ? 'day' : 'week'))
  const [anchor, setAnchor] = useState(today)
  const [who, setWho] = useState('')
  const [showDone, setShowDone] = useState(false)
  const [dragOver, setDragOver] = useState<string | null>(null)

  const days = useMemo(() => {
    if (mode === 'day') return [anchor]
    if (mode === 'week') { const s = weekStartISO(anchor); return Array.from({ length: 7 }, (_, i) => addDaysISO(s, i)) }
    const s = weekStartISO(`${anchor.slice(0, 7)}-01`)
    return Array.from({ length: 42 }, (_, i) => addDaysISO(s, i))
  }, [mode, anchor])
  const { events, status, loading, reload } = useCalendarEvents(days[0], days[days.length - 1])

  const visibleTasks = useMemo(() => tasks.filter(t => !t.needs_triage && t.scheduled_date
    && (!who || (t.is_shared || t.assigned_to === who)) && (showDone || t.status !== 'concluida')), [tasks, who, showDone])
  const tasksOn = (d: string) => visibleTasks.filter(t => t.scheduled_date === d)
  const eventsOn = (d: string) => events.filter(e => (!who || e.owner_id === who) && (e.all_day ? (e.start.slice(0, 10) <= d && d < e.end.slice(0, 10)) : spDate(new Date(e.start)) === d))

  const [y, m] = anchor.split('-').map(Number)
  const fmt = (iso: string) => `${Number(iso.slice(8))} ${MONTHS_FULL[Number(iso.slice(5, 7)) - 1].slice(0, 3).toLowerCase()}`
  const title = mode === 'month' ? `${MONTHS_FULL[m - 1]} ${y}` : mode === 'week' ? `${fmt(days[0])} – ${fmt(days[6])}` : new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(anchor + 'T12:00:00Z'))
  const move = (dir: number) => {
    if (mode === 'day') return setAnchor(addDaysISO(anchor, dir))
    if (mode === 'week') return setAnchor(addDaysISO(anchor, 7 * dir))
    setAnchor(new Date(Date.UTC(y, m - 1 + dir, 1)).toISOString().slice(0, 10))
  }
  const hasFeed = Object.keys(status).length > 0
  const feedErrors = Object.entries(status).filter(([, v]) => v !== 'ok')

  if (!tasksLoaded) return <Spinner />

  const taskChip = (t: Task) => (
    <button key={t.id} draggable onDragStart={e => e.dataTransfer.setData('text/task', t.id)} onClick={e => { e.stopPropagation(); openTask(t.id) }} data-testid="cal-chip"
      className={`block w-full truncate rounded-md border-l-[3px] px-1.5 py-1 text-left text-[11.5px] leading-tight ${t.is_shared ? 'border-l-[#b07a6a]' : CHIP[memberColorIndex(members, t.assigned_to)]} ${t.status === 'concluida' ? 'bg-off text-mute line-through' : isOverdue(t) || isTimePassed(t) ? 'bg-late-50 text-late font-medium' : 'bg-bordo-50/60 hover:bg-bordo-50'}`}>
      {effectiveTime(t) && <span className="mr-1 font-semibold">{timeLabel(t, true)}</span>}{t.title}
    </button>
  )
  const eventChip = (e: CalEvent, i: number) => (
    <div key={`e${i}`} title={e.title} data-testid="cal-event" className={`truncate rounded-md border border-line px-1.5 py-0.5 text-[11px] text-mute ${e.owner_id === me.id ? 'bg-paper' : 'bg-off italic'}`}>
      {!e.all_day && <span className="mr-1">{hhmm(spMinutes(new Date(e.start)))}</span>}{e.title}
    </div>
  )

  return (
    <div>
      <PageHeader eyebrow="Agenda e pendências" title="Calendário">
        <div className="inline-flex rounded-full border border-line bg-paper p-1 text-sm">
          {(['day', 'week', 'month'] as const).map(v => <button key={v} aria-pressed={mode === v} onClick={() => setMode(v)} className={`rounded-full px-3 py-1.5 ${mode === v ? 'bg-bordo text-off' : 'text-mute'}`}>{v === 'month' ? 'Mês' : v === 'week' ? 'Semana' : 'Dia'}</button>)}
        </div>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button className="btn btn-ghost px-2.5" onClick={() => move(-1)} aria-label="Período anterior"><ChevronLeft size={16} /></button>
          <button className="btn btn-ghost" onClick={() => setAnchor(today)}>Hoje</button>
          <button className="btn btn-ghost px-2.5" onClick={() => move(1)} aria-label="Próximo período"><ChevronRight size={16} /></button>
        </div>
        <h2 className="font-serif text-2xl first-letter:uppercase" data-testid="cal-title">{title}</h2>
        <div className="ml-auto flex flex-wrap items-center gap-3 text-sm">
          <button onClick={() => setWho('')} className={`rounded-full px-3 py-1 ${!who ? 'bg-ink text-off' : 'text-mute'}`}>Todas</button>
          {members.map((mb, i) => (
            <button key={mb.user_id} onClick={() => setWho(w => w === mb.user_id ? '' : mb.user_id)} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${who === mb.user_id ? 'bg-ink text-off' : 'text-ink'}`}>
              <span className={`h-2.5 w-2.5 rounded-full ${DOT[i % DOT.length]}`} />{firstName(mb.profile.name)}
            </button>
          ))}
          <label className="inline-flex items-center gap-1.5 text-mute"><input type="checkbox" className="accent-[#3A0000]" checked={showDone} onChange={e => setShowDone(e.target.checked)} />Concluídas</label>
          {hasFeed && <button className="btn-text inline-flex items-center gap-1 text-xs" onClick={() => reload(true)} title="Atualizar Google Agenda"><RefreshCw size={13} className={loading ? 'animate-spin' : ''} />Agenda</button>}
        </div>
      </div>

      {!hasFeed && <div className="mb-4 rounded-2xl border border-line bg-paper px-4 py-3 text-sm text-mute">Conecte seu Google Agenda em <Link className="text-bordo underline" to="/configuracoes">Configurações</Link> para ver seus compromissos aqui e encaixar as pendências nas janelas livres.</div>}
      {feedErrors.length > 0 && <div className="mb-4 rounded-2xl border border-[#ecd2cc] bg-late-50 px-4 py-3 text-sm text-late">Não foi possível ler a agenda de {feedErrors.map(([id]) => firstName(members.find(x => x.user_id === id)?.profile.name)).join(', ')}: {feedErrors[0][1]}</div>}

      {mode === 'month' ? (
        <div className="card overflow-hidden">
          <div className="hidden md:grid grid-cols-7 border-b border-line bg-off/60">{WEEKDAYS.map(d => <div key={d} className="px-3 py-2 eyebrow">{d}</div>)}</div>
          <div className="grid grid-cols-7">
            {days.map((d, i) => {
              const list = tasksOn(d); const evs = eventsOn(d)
              const outside = d.slice(0, 7) !== anchor.slice(0, 7)
              return (
                <div key={d} data-testid={`cal-day-${d}`}
                  onDragOver={e => { e.preventDefault(); setDragOver(d) }} onDragLeave={() => setDragOver(null)}
                  onDrop={e => { e.preventDefault(); setDragOver(null); const id = e.dataTransfer.getData('text/task'); if (id) updateTask(id, { scheduled_date: d }) }}
                  onDoubleClick={() => openNew({ scheduled_date: d })}
                  className={`group min-h-[64px] md:min-h-[118px] border-line p-1.5 md:p-2 ${i % 7 !== 6 ? 'border-r' : ''} ${i < 35 ? 'border-b' : ''} ${outside ? 'bg-off/50' : ''} ${dragOver === d ? 'bg-bordo-50' : ''}`}>
                  <div className="mb-1 flex items-center justify-between">
                    <button onClick={() => { setAnchor(d); setMode('day') }} className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs tabular-nums ${d === today ? 'bg-bordo text-off font-semibold' : outside ? 'text-mute/60' : 'text-ink hover:bg-off'}`}>{Number(d.slice(8))}</button>
                    {evs.length > 0 && <span className="text-[10px] text-mute md:hidden">{evs.length}</span>}
                  </div>
                  <div className="flex flex-wrap gap-1 md:hidden">
                    {list.slice(0, 6).map(t => <button key={t.id} onClick={() => openTask(t.id)} aria-label={t.title} className={`h-2 w-2 rounded-full ${isOverdue(t) ? 'bg-late' : DOT[memberColorIndex(members, t.assigned_to)]}`} />)}
                  </div>
                  <div className="hidden md:block space-y-1">
                    {list.slice(0, 3).map(taskChip)}
                    {evs.slice(0, Math.max(0, 4 - Math.min(3, list.length))).map(eventChip)}
                    {list.length + evs.length > 4 && <div className="px-1 text-[11px] text-mute">+{list.length + evs.length - 4} mais</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <TimeGrid days={days} today={today} tasksOn={tasksOn} eventsOn={eventsOn} taskChip={taskChip} eventChip={eventChip}
          onDropTask={(id, d, min) => updateTask(id, min == null ? { scheduled_date: d } : { scheduled_date: d, due_time: hhmm(min), time_window: null })}
          onNew={(d, min) => openNew({ scheduled_date: d, due_time: min == null ? undefined : hhmm(min) })}
          onOpen={openTask} me={me.id} />
      )}
      <p className="mt-3 text-xs text-mute">
        {mode === 'month' ? 'Arraste uma pendência para outro dia. Clique no número para ver o dia em horas.' : 'Arraste uma pendência para um horário livre da grade para definir até que horas ela deve ser feita. Clique duas vezes num horário para criar uma pendência ali.'}
        {hasFeed && ' Compromissos do Google Agenda aparecem em cinza (atualizados a cada 15 min).'}
      </p>
    </div>
  )
}

interface Block { key: string; top: number; height: number; lane: number; lanes: number; node: React.ReactNode }
function layout(items: { key: string; start: number; end: number; node: React.ReactNode }[]): Block[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end)
  const out: Block[] = []; let group: Block[] = []; let groupEnd = -1; const laneEnds: number[] = []
  const flush = () => { const n = Math.max(1, ...group.map(g => g.lane + 1)); group.forEach(g => (g.lanes = n)); group = []; laneEnds.length = 0 }
  for (const it of sorted) {
    if (it.start >= groupEnd) { flush(); groupEnd = it.end } else groupEnd = Math.max(groupEnd, it.end)
    let lane = laneEnds.findIndex(e => e <= it.start)
    if (lane < 0) { lane = laneEnds.length; laneEnds.push(it.end) } else laneEnds[lane] = it.end
    const b: Block = { key: it.key, top: ((Math.max(it.start, H0 * 60) - H0 * 60) / 60) * PX, height: Math.max(22, ((Math.min(it.end, H1 * 60) - Math.max(it.start, H0 * 60)) / 60) * PX - 2), lane, lanes: 1, node: it.node }
    out.push(b); group.push(b)
  }
  flush()
  return out
}

function TimeGrid({ days, today, tasksOn, eventsOn, taskChip, eventChip, onDropTask, onNew, onOpen, me }: {
  days: string[]; today: string; me: string
  tasksOn: (d: string) => Task[]; eventsOn: (d: string) => CalEvent[]
  taskChip: (t: Task) => React.ReactNode; eventChip: (e: CalEvent, i: number) => React.ReactNode
  onDropTask: (id: string, d: string, min: number | null) => void; onNew: (d: string, min: number | null) => void; onOpen: (id: string) => void
}) {
  const [hover, setHover] = useState<{ d: string; min: number } | null>(null)
  const [nowMin, setNowMin] = useState(spMinutes(new Date()))
  useEffect(() => { const i = setInterval(() => setNowMin(spMinutes(new Date())), 60000); return () => clearInterval(i) }, [])
  const minFromEvent = (e: React.DragEvent | React.MouseEvent, el: HTMLElement) => {
    const y = e.clientY - el.getBoundingClientRect().top
    return Math.min(H1 * 60 - 15, Math.max(H0 * 60 + 15, H0 * 60 + Math.round((y / PX) * 4) * 15))
  }
  const hours = Array.from({ length: H1 - H0 }, (_, i) => H0 + i)
  const cols = days.length === 1 ? 'grid-cols-[56px_1fr]' : 'grid-cols-[56px_repeat(7,minmax(110px,1fr))]'
  return (
    <div className="card overflow-x-auto scrollbar-thin" data-testid="time-grid">
      <div className={`grid ${cols} min-w-full`}>
        <div className="border-b border-line bg-off/60" />
        {days.map(d => (
          <div key={d} className={`border-b border-l border-line px-2 py-2 ${d === today ? 'bg-bordo-50/60' : 'bg-off/60'}`}>
            <div className="eyebrow">{WEEKDAYS[(new Date(d + 'T12:00:00Z').getUTCDay() + 6) % 7]}</div>
            <div className={`text-lg tabular-nums ${d === today ? 'font-semibold text-bordo' : ''}`}>{Number(d.slice(8))}</div>
          </div>
        ))}
        {/* dia inteiro: pendências sem horário e eventos de dia inteiro */}
        <div className="border-b border-line px-1 py-1 text-right text-[10px] text-mute">dia todo</div>
        {days.map(d => (
          <div key={d} data-testid={`allday-${d}`} className="space-y-1 border-b border-l border-line p-1 min-h-10"
            onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const id = e.dataTransfer.getData('text/task'); if (id) onDropTask(id, d, null) }}>
            {tasksOn(d).filter(t => !effectiveTime(t)).map(taskChip)}
            {eventsOn(d).filter(e => e.all_day).map(eventChip)}
          </div>
        ))}
        <div className="relative">
          {hours.map(h => <div key={h} style={{ height: PX }} className="border-b border-line/70 pr-1.5 text-right text-[10px] text-mute">{h}h</div>)}
        </div>
        {days.map(d => {
          const items = [
            ...eventsOn(d).filter(e => !e.all_day).map((e, i) => {
              const s = spDate(new Date(e.start)) === d ? spMinutes(new Date(e.start)) : 0
              const en = spDate(new Date(e.end)) === d ? spMinutes(new Date(e.end)) : 24 * 60
              return { key: `e${i}`, start: s, end: Math.max(en, s + 15), node: (
                <div title={`${e.title} · ${hhmm(s)}–${hhmm(en)}`} data-testid="grid-event" className={`h-full overflow-hidden rounded-md border px-1.5 py-0.5 text-[11px] leading-tight ${e.owner_id === me ? 'border-line bg-[#ece8e2] text-ink/80' : 'border-dashed border-[#d6cfc6] bg-off text-mute italic'}`}>
                  <div className="font-medium truncate">{e.title}</div><div className="text-[10px] text-mute">{hhmm(s)}–{hhmm(en)}</div>
                </div>) }
            }),
            ...tasksOn(d).filter(t => effectiveTime(t)).map(t => {
              const [hh, mm] = effectiveTime(t)!.split(':').map(Number); const end = hh * 60 + mm
              return { key: t.id, start: end - 30, end, node: (
                <button draggable onDragStart={e => e.dataTransfer.setData('text/task', t.id)} onClick={() => onOpen(t.id)} data-testid="grid-task"
                  className={`h-full w-full overflow-hidden rounded-md border-l-[3px] px-1.5 py-0.5 text-left text-[11px] leading-tight shadow-sm ${t.status === 'concluida' ? 'border-l-ok bg-ok-50 text-mute line-through' : isTimePassed(t) ? 'border-l-late bg-late-50 text-late' : 'border-l-bordo bg-bordo-50 text-bordo'}`}>
                  <div className="font-semibold truncate">{t.title}</div><div className="text-[10px] opacity-80">{timeLabel(t)}</div>
                </button>) }
            }),
          ]
          const blocks = layout(items)
          return (
            <div key={d} data-testid={`grid-day-${d}`} className={`relative border-l border-line ${d === today ? 'bg-bordo-50/20' : ''}`} style={{ height: (H1 - H0) * PX }}
              onDragOver={e => { e.preventDefault(); setHover({ d, min: minFromEvent(e, e.currentTarget) }) }}
              onDragLeave={() => setHover(null)}
              onDrop={e => { e.preventDefault(); setHover(null); const id = e.dataTransfer.getData('text/task'); if (id) onDropTask(id, d, minFromEvent(e, e.currentTarget)) }}
              onDoubleClick={e => { if (e.target === e.currentTarget) onNew(d, minFromEvent(e, e.currentTarget)) }}>
              {hours.map(h => <div key={h} style={{ top: (h - H0) * PX, height: PX }} className="pointer-events-none absolute inset-x-0 border-b border-line/50" />)}
              {d === today && nowMin >= H0 * 60 && nowMin <= H1 * 60 && <div className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-late" style={{ top: ((nowMin - H0 * 60) / 60) * PX }} />}
              {hover?.d === d && <div className="pointer-events-none absolute inset-x-1 z-10 rounded bg-bordo/10 px-1 text-[10px] text-bordo" style={{ top: ((hover.min - H0 * 60) / 60) * PX - 16, height: 18 }}>até {hhmm(hover.min)}</div>}
              {blocks.map(b => (
                <div key={b.key} className="absolute z-[5] px-0.5" style={{ top: b.top, height: b.height, left: `${(b.lane / b.lanes) * 100}%`, width: `${100 / b.lanes}%` }}>{b.node}</div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
