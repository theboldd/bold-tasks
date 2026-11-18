import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useWs } from '../lib/store'
import { useUI } from '../lib/ui'
import { describeActivity } from '../lib/activity'
import { firstName, formatDateTime } from '../lib/labels'
import type { Activity } from '../lib/types'
import { Avatar, Empty, PageHeader, memberColorIndex } from '../components/ui'

const PAGE = 60
const ACTIONS = [
  { value: '', label: 'Todas as ações' },
  { value: 'created', label: 'Criações' },
  { value: 'captured', label: 'Capturas rápidas' },
  { value: 'updated', label: 'Edições' },
  { value: 'commented', label: 'Comentários' },
  { value: 'completed', label: 'Conclusões' },
  { value: 'reopened', label: 'Reaberturas' },
  { value: 'deleted', label: 'Exclusões' },
]

export function HistoryPage() {
  const { workspace, members, memberName, tasks } = useWs()
  const { openTask } = useUI()
  const [items, setItems] = useState<Activity[]>([])
  const [titles, setTitles] = useState<Record<string, string>>({})
  const [who, setWho] = useState('')
  const [action, setAction] = useState('')
  const [loading, setLoading] = useState(true)
  const [more, setMore] = useState(false)

  const load = useCallback(async (before?: string) => {
    setLoading(true)
    let q = supabase.from('task_activity').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(PAGE)
    if (who) q = q.eq('user_id', who)
    if (action) q = q.eq('action', action)
    if (before) q = q.lt('created_at', before)
    const { data } = await q
    const rows = (data ?? []) as Activity[]
    setItems(prev => before ? [...prev, ...rows] : rows)
    setMore(rows.length === PAGE)
    // títulos de pendências excluídas (não estão no estado local)
    const missing = [...new Set(rows.map(r => r.task_id))].filter(id => !tasks.some(t => t.id === id))
    if (missing.length) {
      const { data: tt } = await supabase.from('tasks').select('id,title').in('id', missing)
      setTitles(prev => ({ ...prev, ...Object.fromEntries((tt ?? []).map(t => [t.id, t.title])) }))
    }
    setLoading(false)
  }, [workspace.id, who, action, tasks])

  useEffect(() => { load() }, [who, action, workspace.id]) // eslint-disable-line

  useEffect(() => {
    const ch = supabase.channel(`hist-${workspace.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'task_activity', filter: `workspace_id=eq.${workspace.id}` }, p => {
        const a = p.new as Activity
        if ((who && a.user_id !== who) || (action && a.action !== action)) return
        setItems(prev => prev.some(x => x.id === a.id) ? prev : [a, ...prev])
      }).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [workspace.id, who, action])

  const titleOf = (id: string) => tasks.find(t => t.id === id)?.title ?? titles[id] ?? 'Pendência'
  const alive = (id: string) => tasks.some(t => t.id === id)

  // agrupar por dia
  const groups: { day: string; rows: Activity[] }[] = []
  for (const a of items) {
    const day = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(a.created_at))
    const g = groups[groups.length - 1]
    if (g?.day === day) g.rows.push(a); else groups.push({ day, rows: [a] })
  }

  return (
    <div>
      <PageHeader eyebrow="Rastreabilidade" title="Histórico">
        <select aria-label="Filtrar por pessoa" className="field w-auto py-2" value={who} onChange={e => setWho(e.target.value)}>
          <option value="">Todas as pessoas</option>
          {members.map(m => <option key={m.user_id} value={m.user_id}>{m.profile.name}</option>)}
        </select>
        <select aria-label="Filtrar por ação" className="field w-auto py-2" value={action} onChange={e => setAction(e.target.value)}>
          {ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
      </PageHeader>
      {!loading && !items.length ? <Empty title="Sem registros" text="As atividades aparecem aqui conforme as pendências são criadas e alteradas." /> : (
        <div className="space-y-8">
          {groups.map(g => (
            <section key={g.day}>
              <h2 className="eyebrow mb-3">{g.day}</h2>
              <ul className="card divide-y divide-line">
                {g.rows.map(a => (
                  <li key={a.id} className="flex items-start gap-3 px-4 py-3 text-sm" data-testid="history-item">
                    <Avatar name={a.user_id ? memberName(a.user_id) : 'Sistema'} idx={memberColorIndex(members, a.user_id)} size={28} />
                    <div className="min-w-0 flex-1">
                      <div><strong className="font-semibold">{a.user_id ? firstName(memberName(a.user_id)) : 'Sistema'}</strong> {describeActivity(a, memberName)}</div>
                      {alive(a.task_id)
                        ? <button className="max-w-full truncate text-left text-mute hover:text-bordo" onClick={() => openTask(a.task_id)}>{titleOf(a.task_id)}</button>
                        : <span className="text-mute line-through">{titleOf(a.task_id)}</span>}
                      {a.action === 'commented' && a.new_value && <p className="mt-1 border-l-2 border-line pl-3 italic text-mute">{a.new_value}</p>}
                    </div>
                    <span className="shrink-0 text-xs text-mute tabular-nums">{formatDateTime(a.created_at).split(', ').pop()}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {more && <div className="text-center"><button className="btn btn-ghost" disabled={loading} onClick={() => load(items[items.length - 1]?.created_at)}>{loading ? 'Carregando…' : 'Carregar mais'}</button></div>}
        </div>
      )}
    </div>
  )
}
