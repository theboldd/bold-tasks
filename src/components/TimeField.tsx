import { WINDOWS } from '../lib/labels'
import type { TimeWindow } from '../lib/types'

export interface TimeValue { due_time: string | null; time_window: TimeWindow | null }

/** "Até que horas": sem horário, janelas do dia ou horário exato */
export function TimeField({ value, onChange, idPrefix = 'tf', compact }: { value: TimeValue; onChange: (v: TimeValue) => void; idPrefix?: string; compact?: boolean }) {
  const mode = value.due_time ? 'exato' : value.time_window ?? ''
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select id={`${idPrefix}-time-mode`} aria-label="Até que horas" className={`field ${compact ? 'py-1.5' : ''} w-auto flex-1 min-w-40`} value={mode}
        onChange={e => {
          const v = e.target.value
          if (v === '') onChange({ due_time: null, time_window: null })
          else if (v === 'exato') onChange({ due_time: value.due_time ?? '15:00', time_window: null })
          else onChange({ due_time: null, time_window: v as TimeWindow })
        }}>
        <option value="">Sem horário</option>
        {WINDOWS.map(w => <option key={w.value} value={w.value}>{w.label} ({w.end})</option>)}
        <option value="exato">Horário exato…</option>
      </select>
      {mode === 'exato' && (
        <input id={`${idPrefix}-time`} aria-label="Horário" type="time" step={900} className={`field ${compact ? 'py-1.5' : ''} w-32`}
          value={value.due_time?.slice(0, 5) ?? ''} onChange={e => onChange({ due_time: e.target.value || null, time_window: null })} />
      )}
    </div>
  )
}
