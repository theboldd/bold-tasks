import type { Priority, Status, Task } from './types'

export const STATUS: { value: Status; label: string }[] = [
  { value: 'a_fazer', label: 'A fazer' },
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'aguardando', label: 'Aguardando' },
  { value: 'concluida', label: 'Concluída' },
]
export const PRIORITY: { value: Priority; label: string }[] = [
  { value: 'alta', label: 'Alta' },
  { value: 'normal', label: 'Normal' },
  { value: 'baixa', label: 'Baixa' },
]
export const statusLabel = (s: string) => STATUS.find(x => x.value === s)?.label ?? s
export const priorityLabel = (p: string) => PRIORITY.find(x => x.value === p)?.label ?? p
export const PRIORITY_RANK: Record<Priority, number> = { alta: 0, normal: 1, baixa: 2 }

const TZ = 'America/Sao_Paulo'
export function todayISO(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}
export function addDaysISO(iso: string, n: number) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return dt.toISOString().slice(0, 10)
}
export function weekStartISO(iso = todayISO()) {
  const [y, m, d] = iso.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0 dom
  const diff = dow === 0 ? -6 : 1 - dow
  return addDaysISO(iso, diff)
}

export const isOpen = (t: Task) => t.status !== 'concluida'
export const isOverdue = (t: Task, today = todayISO()) => isOpen(t) && !!t.due_date && t.due_date < today
export const isDueToday = (t: Task, today = todayISO()) => isOpen(t) && t.due_date === today

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
export const MONTHS_FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
export const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

export function formatDue(iso: string | null, today = todayISO()) {
  if (!iso) return 'Sem prazo'
  if (iso === today) return 'Hoje'
  if (iso === addDaysISO(today, 1)) return 'Amanhã'
  if (iso === addDaysISO(today, -1)) return 'Ontem'
  const [y, m, d] = iso.split('-').map(Number)
  const ty = Number(today.slice(0, 4))
  return `${d} ${MONTHS[m - 1]}${y !== ty ? ` ${y}` : ''}`
}

export function formatDateTime(ts: string) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(ts))
}
export function timeAgo(ts: string) {
  const s = Math.round((Date.now() - new Date(ts).getTime()) / 1000)
  if (s < 60) return 'agora'
  if (s < 3600) return `há ${Math.floor(s / 60)} min`
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`
  if (s < 86400 * 7) return `há ${Math.floor(s / 86400)} d`
  return formatDateTime(ts)
}
export const firstName = (n?: string | null) => (n ?? '').split(' ')[0]
export const initials = (n?: string | null) => (n ?? '?').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('')
