import { PRIORITY_RANK, addDaysISO, isOverdue, todayISO, weekStartISO } from './labels'
import type { Member, Task } from './types'

export interface Filters {
  q: string
  assigned: string // '' | uid | 'none'
  createdBy: string
  category: string // '' | 'the_bold' | 'pessoal:uid'
  status: string // '' | 'open' | Status
  priority: string
  due: string // '' | 'today' | 'week' | 'next7' | 'month'
  overdue: boolean
  noDue: boolean
  triage: boolean
  sort: 'due' | 'priority' | 'created'
}
export const EMPTY_FILTERS: Filters = { q: '', assigned: '', createdBy: '', category: '', status: 'open', priority: '', due: '', overdue: false, noDue: false, triage: false, sort: 'due' }

export function categoryOptions(members: Member[]) {
  return [
    { value: 'the_bold', label: 'The Bold' },
    ...members.map(m => ({ value: `pessoal:${m.user_id}`, label: `Pessoal — ${m.profile.name.split(' ')[0]}` })),
  ]
}
export const encodeCategory = (t: Pick<Task, 'category' | 'category_owner'>) =>
  t.category === 'pessoal' ? `pessoal:${t.category_owner}` : t.category ?? ''
export function decodeCategory(v: string): { category: Task['category']; category_owner: string | null } {
  if (v.startsWith('pessoal:')) return { category: 'pessoal', category_owner: v.slice(8) }
  if (v === 'the_bold') return { category: 'the_bold', category_owner: null }
  return { category: null, category_owner: null }
}
export function categoryLabel(t: Pick<Task, 'category' | 'category_owner'>, memberName: (id: string | null) => string) {
  if (t.category === 'the_bold') return 'The Bold'
  if (t.category === 'pessoal') return `Pessoal — ${memberName(t.category_owner).split(' ')[0]}`
  return 'Sem categoria'
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function applyFilters(tasks: Task[], f: Filters) {
  const today = todayISO()
  const q = norm(f.q.trim())
  let out = tasks.filter(t => {
    if (q && !norm(`${t.title} ${t.description ?? ''} #${t.seq}`).includes(q)) return false
    if (f.assigned === 'none' ? t.assigned_to !== null : f.assigned && t.assigned_to !== f.assigned) return false
    if (f.createdBy && t.created_by !== f.createdBy) return false
    if (f.category && encodeCategory(t) !== f.category) return false
    if (f.status === 'open' && t.status === 'concluida') return false
    if (f.status && f.status !== 'open' && t.status !== f.status) return false
    if (f.priority && t.priority !== f.priority) return false
    if (f.overdue && !isOverdue(t, today)) return false
    if (f.noDue && t.due_date) return false
    if (f.triage && !t.needs_triage) return false
    if (f.due) {
      if (!t.due_date) return false
      const d = t.due_date
      if (f.due === 'today' && d !== today) return false
      if (f.due === 'week') { const ws = weekStartISO(today); if (d < ws || d > addDaysISO(ws, 6)) return false }
      if (f.due === 'next7' && (d < today || d > addDaysISO(today, 7))) return false
      if (f.due === 'month' && d.slice(0, 7) !== today.slice(0, 7)) return false
    }
    return true
  })
  out = [...out].sort((a, b) => {
    if (f.sort === 'created') return b.created_at.localeCompare(a.created_at)
    if (f.sort === 'priority') return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || dueCmp(a, b)
    return dueCmp(a, b) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
  })
  return out
}
function dueCmp(a: Task, b: Task) {
  if (a.due_date === b.due_date) return b.created_at.localeCompare(a.created_at)
  if (!a.due_date) return 1
  if (!b.due_date) return -1
  return a.due_date.localeCompare(b.due_date)
}

export function filtersFromParams(p: URLSearchParams, base: Filters): Filters {
  const f = { ...base }
  for (const k of Object.keys(base) as (keyof Filters)[]) {
    const v = p.get(k)
    if (v === null) continue
    if (typeof base[k] === 'boolean') (f as Record<string, unknown>)[k] = v === '1'
    else (f as Record<string, unknown>)[k] = v
  }
  return f
}
export function filtersToParams(f: Filters, base: Filters, p: URLSearchParams) {
  for (const k of Object.keys(base) as (keyof Filters)[]) {
    const v = f[k]
    if (v === base[k]) p.delete(k)
    else p.set(k, typeof v === 'boolean' ? (v ? '1' : '0') : String(v))
  }
  return p
}
