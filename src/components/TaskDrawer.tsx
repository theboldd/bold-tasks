import { useEffect, useState } from 'react'
import { Check, RotateCcw, Trash2, X, Send } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast, useWs } from '../lib/store'
import { PRIORITY, STATUS, formatDateTime, isOverdue, timeAgo } from '../lib/labels'
import { categoryLabel, categoryOptions, decodeCategory, encodeCategory } from '../lib/filters'
import { describeActivity } from '../lib/activity'
import type { Activity, Comment, Priority, Status, Task } from '../lib/types'
import { Avatar, StatusPill, TriageBadge, memberColorIndex } from './ui'

export function TaskDrawer({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const { tasks, members, memberName, deleteTask, me } = useWs()
  const toast = useToast()
  const task = tasks.find(t => t.id === taskId)
  const [missing, setMissing] = useState(false)
  const [tab, setTab] = useState<'comments' | 'history'>('comments')
  const [comments, setComments] = useState<Comment[]>([])
  const [activity, setActivity] = useState<Activity[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])

  useEffect(() => {
    setConfirmDelete(false); setDraft('')
    let alive = true
    supabase.from('task_comments').select('*').eq('task_id', taskId).order('created_at').then(({ data }) => alive && setComments((data ?? []) as Comment[]))
    supabase.from('task_activity').select('*').eq('task_id', taskId).order('created_at', { ascending: false }).then(({ data }) => alive && setActivity((data ?? []) as Activity[]))
    const ch = supabase.channel(`task-${taskId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'task_comments', filter: `task_id=eq.${taskId}` }, p => {
        const c = p.new as Comment
        setComments(prev => prev.some(x => x.id === c.id) ? prev : [...prev, c])
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'task_activity', filter: `task_id=eq.${taskId}` }, p => {
        const a = p.new as Activity
        setActivity(prev => prev.some(x => x.id === a.id) ? prev : [a, ...prev])
      })
      .subscribe()
    return () => { alive = false; supabase.removeChannel(ch) }
  }, [taskId])

  useEffect(() => {
    if (task) { setMissing(false); return }
    const t = setTimeout(() => setMissing(true), 1500)
    return () => clearTimeout(t)
  }, [task])

  async function sendComment(e: React.FormEvent) {
    e.preventDefault()
    if (!draft.trim()) return
    setSending(true)
    const { data, error } = await supabase.from('task_comments').insert({ task_id: taskId, user_id: me.id, content: draft.trim() }).select('*').single()
    setSending(false)
    if (error) { toast(error.message, 'error'); return }
    setComments(prev => prev.some(x => x.id === data.id) ? prev : [...prev, data as Comment])
    setDraft('')
  }

  return (
    <div className="fixed inset-0 z-[55] flex justify-end bg-ink/20 fade-in" onMouseDown={onClose}>
      <aside aria-label="Detalhes da pendência" className="slide-in h-full w-full md:max-w-[560px] overflow-y-auto bg-paper shadow-2xl" onMouseDown={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-paper/95 px-5 py-3 backdrop-blur">
          <span className="eyebrow">{task ? `Pendência #${task.seq}` : 'Pendência'}</span>
          <button className="btn-text rounded-full" onClick={onClose} aria-label="Fechar detalhes"><X size={18} /></button>
        </div>
        {!task ? (
          <div className="p-8 text-sm text-mute">{missing ? 'Esta pendência não existe mais ou foi excluída.' : 'Carregando…'}</div>
        ) : (
          <TaskBody key={task.id} task={task} />
        )}

        {task && (
          <div className="px-5 pb-10">
            <div className="mb-4 flex gap-5 border-b border-line text-sm">
              {(['comments', 'history'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} className={`-mb-px border-b-2 pb-2.5 ${tab === t ? 'border-bordo font-medium text-ink' : 'border-transparent text-mute'}`}>
                  {t === 'comments' ? `Comentários (${comments.length})` : 'Histórico'}
                </button>
              ))}
            </div>
            {tab === 'comments' ? (
              <div>
                <ul className="space-y-4 mb-4">
                  {comments.length === 0 && <li className="text-sm text-mute">Nenhum comentário ainda. Use este espaço para alinhar o contexto da demanda.</li>}
                  {comments.map(c => (
                    <li key={c.id} className="flex gap-3">
                      <Avatar name={memberName(c.user_id)} idx={memberColorIndex(members, c.user_id)} size={28} />
                      <div className="min-w-0">
                        <div className="text-xs text-mute"><strong className="font-semibold text-ink">{memberName(c.user_id)}</strong> · {timeAgo(c.created_at)}</div>
                        <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">{c.content}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                <form onSubmit={sendComment} className="flex items-end gap-2">
                  <textarea aria-label="Novo comentário" className="field min-h-11 flex-1" rows={1} value={draft} onChange={e => setDraft(e.target.value)} placeholder="Escreva um comentário…"
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendComment(e) } }} />
                  <button className="btn btn-primary h-11" disabled={sending || !draft.trim()} aria-label="Enviar comentário"><Send size={15} /></button>
                </form>
              </div>
            ) : (
              <ol className="relative space-y-4 border-l border-line pl-5">
                {activity.map(a => (
                  <li key={a.id} className="text-sm">
                    <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full border-2 border-paper bg-bordo" />
                    <strong className="font-semibold">{a.user_id ? memberName(a.user_id).split(' ')[0] : 'Sistema'}</strong> {describeActivity(a, memberName)}
                    {a.action === 'commented' && a.new_value && <span className="block text-mute italic truncate">“{a.new_value}”</span>}
                    <div className="text-xs text-mute">{formatDateTime(a.created_at)}</div>
                  </li>
                ))}
              </ol>
            )}

            <div className="mt-10 border-t border-line pt-4">
              {!confirmDelete ? (
                <button className="btn btn-text text-late hover:text-late" onClick={() => setConfirmDelete(true)}><Trash2 size={15} />Excluir pendência</button>
              ) : (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span>Excluir esta pendência? Ela sai das listas, mas o histórico fica preservado.</span>
                  <button className="btn bg-late text-white" onClick={async () => { if (await deleteTask(task.id)) { toast('Pendência excluída'); onClose() } }}>Confirmar exclusão</button>
                  <button className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>Cancelar</button>
                </div>
              )}
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}

function TaskBody({ task }: { task: Task }) {
  const { members, memberName, updateTask } = useWs()
  const toast = useToast()
  const [title, setTitle] = useState(task.title)
  const [desc, setDesc] = useState(task.description ?? '')
  // classificação de captura rápida
  const [triAssigned, setTriAssigned] = useState(task.assigned_to ?? '')
  const [triCat, setTriCat] = useState(encodeCategory(task) || 'the_bold')
  useEffect(() => setTitle(task.title), [task.title])
  useEffect(() => setDesc(task.description ?? ''), [task.description])

  const done = task.status === 'concluida'
  const late = isOverdue(task)
  const save = (patch: Parameters<typeof updateTask>[1]) => updateTask(task.id, patch)

  return (
    <div className="px-5 pt-5 pb-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <StatusPill status={task.status} />
        {task.needs_triage && <TriageBadge />}
        {late && <span className="rounded bg-late-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-late">Atrasada</span>}
      </div>
      <textarea aria-label="Título" className={`w-full resize-none bg-transparent font-serif text-[1.7rem] leading-tight outline-none ${done ? 'text-mute line-through decoration-1' : ''}`}
        rows={Math.min(4, Math.ceil(title.length / 34) || 1)} value={title} onChange={e => setTitle(e.target.value)}
        onBlur={() => { if (title.trim() && title.trim() !== task.title) save({ title: title.trim() }); else setTitle(task.title) }}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLTextAreaElement).blur() } }} />

      {task.needs_triage && (
        <div className="mt-3 rounded-2xl border border-[#e8dcc3] bg-wait-50 p-4">
          <div className="eyebrow mb-2 text-wait">Classificar captura</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <select aria-label="Responsável da captura" className="field" value={triAssigned} onChange={e => setTriAssigned(e.target.value)}>
              <option value="">Responsável…</option>
              {members.map(m => <option key={m.user_id} value={m.user_id}>{m.profile.name}</option>)}
            </select>
            <select aria-label="Categoria da captura" className="field" value={triCat} onChange={e => setTriCat(e.target.value)}>
              {categoryOptions(members).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <button className="btn btn-primary mt-3" disabled={!triAssigned}
            onClick={async () => { if (await save({ assigned_to: triAssigned, ...decodeCategory(triCat), needs_triage: false })) toast('Captura classificada') }}>
            Confirmar classificação
          </button>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {!done ? (
          <button className="btn btn-primary" disabled={task.needs_triage} title={task.needs_triage ? 'Classifique antes de concluir' : undefined} onClick={() => save({ status: 'concluida' })}><Check size={16} />Concluir</button>
        ) : (
          <button className="btn btn-ghost" onClick={() => save({ status: 'a_fazer' })}><RotateCcw size={15} />Reabrir</button>
        )}
      </div>

      <dl className="mt-6 grid grid-cols-[120px_1fr] items-center gap-x-3 gap-y-3 text-sm">
        {!task.needs_triage && <>
          <dt className="text-mute">Responsável</dt>
          <dd>
            <select aria-label="Responsável" className="field py-1.5" value={task.assigned_to ?? ''} onChange={e => save({ assigned_to: e.target.value })}>
              {members.map(m => <option key={m.user_id} value={m.user_id}>{m.profile.name}</option>)}
            </select>
          </dd>
          <dt className="text-mute">Categoria</dt>
          <dd>
            <select aria-label="Categoria" className="field py-1.5" value={encodeCategory(task)} onChange={e => save(decodeCategory(e.target.value))}>
              {categoryOptions(members).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </dd>
        </>}
        <dt className="text-mute">Status</dt>
        <dd>
          <select aria-label="Status" className="field py-1.5" value={task.status} disabled={task.needs_triage && task.status !== 'concluida'} onChange={e => save({ status: e.target.value as Status })}>
            {STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </dd>
        <dt className="text-mute">Prioridade</dt>
        <dd>
          <select aria-label="Prioridade" className="field py-1.5" value={task.priority} onChange={e => save({ priority: e.target.value as Priority })}>
            {PRIORITY.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </dd>
        <dt className="text-mute">Prazo</dt>
        <dd className="flex items-center gap-2">
          <input aria-label="Prazo" type="date" className={`field py-1.5 ${late ? 'text-late' : ''}`} value={task.due_date ?? ''} onChange={e => save({ due_date: e.target.value || null })} />
          {task.due_date && <button className="btn-text text-xs" onClick={() => save({ due_date: null })}>Limpar</button>}
        </dd>
        <dt className="text-mute">Criado por</dt>
        <dd className="flex items-center gap-2"><Avatar size={22} name={memberName(task.created_by)} idx={memberColorIndex(members, task.created_by)} />{memberName(task.created_by)} <span className="text-mute">· {formatDateTime(task.created_at)}</span></dd>
        {task.category && <><dt className="text-mute">Natureza</dt><dd>{categoryLabel(task, memberName)}</dd></>}
        {done && task.completed_at && <>
          <dt className="text-mute">Concluída</dt>
          <dd className="text-ok">por {memberName(task.completed_by)} · {formatDateTime(task.completed_at)}</dd>
        </>}
      </dl>

      <div className="mt-6">
        <label className="eyebrow mb-1.5 block" htmlFor="td-desc">Descrição</label>
        <textarea id="td-desc" className="field min-h-24" value={desc} placeholder="Adicione contexto…" onChange={e => setDesc(e.target.value)}
          onBlur={() => { const v = desc.trim() || null; if (v !== (task.description ?? null)) save({ description: v }) }} />
      </div>
    </div>
  )
}
