import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Member, Notification, Profile, Task, TaskPart, TaskPatch, Workspace } from './types'

/* ================= Auth ================= */
interface AuthCtx { session: Session | null; loading: boolean }
const AuthContext = createContext<AuthCtx>({ session: null, loading: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false) })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  return <AuthContext.Provider value={{ session, loading }}>{children}</AuthContext.Provider>
}
export const useAuth = () => useContext(AuthContext)

/* ================= Toasts ================= */
interface Toast { id: number; text: string; kind: 'ok' | 'error' }
const ToastContext = createContext<(text: string, kind?: 'ok' | 'error') => void>(() => {})
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((text: string, kind: 'ok' | 'error' = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts(t => [...t, { id, text, kind }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3800)
  }, [])
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-[80] flex flex-col gap-2 items-center pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} role="status" className={`rise-in pointer-events-auto rounded-sm px-4 py-2.5 text-[13px] shadow-[0_14px_40px_-18px_rgba(21,19,19,.6)] ${t.kind === "error" ? "bg-late text-white" : "bg-ink text-off"}`}>{t.text}</div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
export const useToast = () => useContext(ToastContext)

/* ================= Workspace / dados ================= */
interface WorkspaceCtx {
  me: Profile
  workspace: Workspace
  workspaces: Workspace[]
  switchWorkspace: (id: string) => void
  members: Member[]
  memberName: (id: string | null | undefined) => string
  other: Member | undefined
  tasks: Task[]
  tasksLoaded: boolean
  notifications: Notification[]
  createTask: (t: Omit<TaskPatch, 'needs_triage'> & { title: string }) => Promise<Task | null>
  quickCapture: (text: string) => Promise<string | null>
  updateTask: (id: string, patch: TaskPatch) => Promise<boolean>
  deleteTask: (id: string) => Promise<boolean>
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
  refresh: () => Promise<void>
  realtimeStatus: string
  parts: TaskPart[]
  partsOf: (taskId: string) => TaskPart[]
  isMine: (t: Task, userId?: string) => boolean
  toggleDone: (t: Task) => Promise<void>
}
const WsContext = createContext<WorkspaceCtx | null>(null)
export function useWs() {
  const c = useContext(WsContext)
  if (!c) throw new Error('useWs fora do provider')
  return c
}

const errMsg = (e: { message?: string } | null) => {
  const m = e?.message ?? 'Erro inesperado'
  if (m.includes('Responsável não pertence')) return 'Responsável inválido para este workspace.'
  if (m.includes('tasks_classified')) return 'Defina responsável e categoria.'
  return m
}

export function WorkspaceProvider({ children, fallback }: { children: ReactNode; fallback: (state: 'loading' | 'no-workspace') => ReactNode }) {
  const { session } = useAuth()
  const toast = useToast()
  const uid = session!.user.id
  const [me, setMe] = useState<Profile | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null)
  const [wsId, setWsId] = useState<string | null>(() => localStorage.getItem('bt_ws'))
  const [members, setMembers] = useState<Member[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [tasksLoaded, setTasksLoaded] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [realtimeStatus, setRealtimeStatus] = useState('connecting')
  const [parts, setParts] = useState<TaskPart[]>([])

  // perfil e workspaces
  useEffect(() => {
    let alive = true
    ;(async () => {
      const [{ data: prof }, { data: wss }] = await Promise.all([
        supabase.from('profiles').select('id,name,email,avatar_url').eq('id', uid).single(),
        supabase.from('workspaces').select('id,name,slug').order('created_at'),
      ])
      if (!alive) return
      setMe(prof as Profile)
      setWorkspaces((wss ?? []) as Workspace[])
    })()
    return () => { alive = false }
  }, [uid])

  const workspace = useMemo(() => {
    if (!workspaces?.length) return null
    return workspaces.find(w => w.id === wsId) ?? workspaces[0]
  }, [workspaces, wsId])

  const loadTasks = useCallback(async (ws: string) => {
    const [{ data, error }, { data: pdata }] = await Promise.all([
      supabase.from('tasks').select('*').eq('workspace_id', ws).is('deleted_at', null).order('created_at', { ascending: false }).limit(5000),
      supabase.from('task_parts').select('*').eq('workspace_id', ws),
    ])
    if (error) { toast(errMsg(error), 'error'); return }
    setTasks((data ?? []) as Task[])
    setParts((pdata ?? []) as TaskPart[])
    setTasksLoaded(true)
  }, [toast])

  const loadNotifications = useCallback(async (ws: string) => {
    const { data } = await supabase.from('notifications').select('*').eq('workspace_id', ws).eq('recipient_id', uid).order('created_at', { ascending: false }).limit(100)
    setNotifications((data ?? []) as Notification[])
  }, [uid])

  // carregar dados + realtime
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  useEffect(() => {
    if (!workspace) return
    const ws = workspace.id
    setTasksLoaded(false)
    // membros antes das tarefas: evita nomes provisórios ("Usuária removida") na primeira renderização
    supabase.from('workspace_members').select('user_id,role,profile:profiles(id,name,email,avatar_url)').eq('workspace_id', ws)
      .then(({ data }) => {
        setMembers(((data ?? []) as unknown as Member[]).sort((a, b) => a.profile.name.localeCompare(b.profile.name)))
        loadTasks(ws)
      })
    loadNotifications(ws)

    const ch = supabase.channel(`ws-${ws}-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `workspace_id=eq.${ws}` }, payload => {
        const row = payload.new as Task
        if (payload.eventType === 'DELETE') return
        setTasks(prev => {
          const rest = prev.filter(t => t.id !== row.id)
          if (row.deleted_at) return rest
          return [row, ...rest].sort((a, b) => b.created_at.localeCompare(a.created_at))
        })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_parts', filter: `workspace_id=eq.${ws}` }, payload => {
        const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as TaskPart
        setParts(prev => {
          const rest = prev.filter(p => !(p.task_id === row.task_id && p.user_id === row.user_id))
          return payload.eventType === 'DELETE' ? rest : [...rest, row]
        })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${uid}` }, payload => {
        const row = payload.new as Notification
        if (!row?.id || row.workspace_id !== ws) return
        setNotifications(prev => [row, ...prev.filter(n => n.id !== row.id)].sort((a, b) => b.created_at.localeCompare(a.created_at)))
      })
      .subscribe(status => {
        setRealtimeStatus(status)
        // ao reconectar, ressincroniza para não perder eventos
        if (status === 'SUBSCRIBED') { loadTasks(ws); loadNotifications(ws) }
      })
    channelRef.current = ch
    const onFocus = () => { loadTasks(ws); loadNotifications(ws) }
    window.addEventListener('focus', onFocus)
    return () => { window.removeEventListener('focus', onFocus); supabase.removeChannel(ch) }
  }, [workspace, uid, loadTasks, loadNotifications])

  const memberName = useCallback((id: string | null | undefined) => {
    if (!id) return '—'
    return members.find(m => m.user_id === id)?.profile.name ?? 'Usuária removida'
  }, [members])

  const upsertLocal = (row: Task) => setTasks(prev => {
    const rest = prev.filter(t => t.id !== row.id)
    return row.deleted_at ? rest : [row, ...rest].sort((a, b) => b.created_at.localeCompare(a.created_at))
  })

  const createTask: WorkspaceCtx['createTask'] = async (t) => {
    if (!workspace) return null
    const { data, error } = await supabase.from('tasks').insert({ ...t, workspace_id: workspace.id, created_by: uid, needs_triage: false }).select('*').single()
    if (error) { toast(errMsg(error), 'error'); return null }
    upsertLocal(data as Task)
    return data as Task
  }
  const quickCapture = async (text: string) => {
    if (!workspace) return null
    const { data, error } = await supabase.rpc('quick_capture', { p_ws: workspace.id, p_text: text })
    if (error) { toast(errMsg(error), 'error'); return null }
    const { data: row } = await supabase.from('tasks').select('*').eq('id', data as string).single()
    if (row) upsertLocal(row as Task)
    return data as string
  }
  const updateTask = async (id: string, patch: TaskPatch) => {
    const before = tasks.find(t => t.id === id)
    if (before) upsertLocal({ ...before, ...patch } as Task) // otimista
    const { data, error } = await supabase.from('tasks').update(patch).eq('id', id).select('*').single()
    if (error) { if (before) upsertLocal(before); toast(errMsg(error), 'error'); return false }
    upsertLocal(data as Task)
    return true
  }
  const deleteTask = async (id: string) => {
    const { error } = await supabase.rpc('soft_delete_task', { p_task: id })
    if (error) { toast(errMsg(error), 'error'); return false }
    setTasks(prev => prev.filter(t => t.id !== id))
    return true
  }
  const markRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
  }
  const markAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    await supabase.rpc('mark_all_notifications_read')
  }
  const partsOf = useCallback((taskId: string) => parts.filter(p => p.task_id === taskId), [parts])
  const isMine = useCallback((t: Task, userId: string = uid) =>
    t.is_shared ? parts.some(p => p.task_id === t.id && p.user_id === userId) || members.some(m => m.user_id === userId) : t.assigned_to === userId,
  [parts, members, uid])
  const toggleDone = async (t: Task) => {
    if (!t.is_shared) { await updateTask(t.id, { status: t.status === 'concluida' ? 'a_fazer' : 'concluida' }); return }
    const mine = parts.find(p => p.task_id === t.id && p.user_id === uid)
    if (t.status === 'concluida' || mine?.completed_at) {
      setParts(prev => prev.map(p => p.task_id === t.id && p.user_id === uid ? { ...p, completed_at: null } : p))
      const { error } = await supabase.rpc('reopen_my_part', { p_task: t.id })
      if (error) { toast(errMsg(error), 'error'); loadTasks(t.workspace_id) } else toast('Sua parte foi reaberta')
    } else {
      setParts(prev => prev.map(p => p.task_id === t.id && p.user_id === uid ? { ...p, completed_at: new Date().toISOString() } : p))
      const { data, error } = await supabase.rpc('complete_my_part', { p_task: t.id })
      if (error) { toast(errMsg(error), 'error'); loadTasks(t.workspace_id); return }
      toast(data === 'concluida' ? 'Pendência das duas concluída' : 'Sua parte foi concluída — a outra foi avisada')
    }
  }
  const refresh = async () => { if (workspace) { await loadTasks(workspace.id); await loadNotifications(workspace.id) } }

  if (workspaces === null || !me) return <>{fallback('loading')}</>
  if (!workspace) return <>{fallback('no-workspace')}</>

  const other = members.find(m => m.user_id !== uid)
  const value: WorkspaceCtx = {
    me, workspace, workspaces,
    switchWorkspace: (id) => { localStorage.setItem('bt_ws', id); setWsId(id) },
    members, memberName, other, tasks, tasksLoaded, notifications,
    createTask, quickCapture, updateTask, deleteTask, markRead, markAllRead, refresh, realtimeStatus,
    parts, partsOf, isMine, toggleDone,
  }
  return <WsContext.Provider value={value}>{children}</WsContext.Provider>
}
