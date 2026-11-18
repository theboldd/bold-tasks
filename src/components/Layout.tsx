import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Bell, CalendarDays, Clock3, Home, Inbox, ListTodo, LogOut, Plus, Search, Settings, User, Users, Building2, Menu, X, History } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useWs } from '../lib/store'
import { UIContext } from '../lib/ui'
import { firstName, isOpen, timeAgo } from '../lib/labels'
import { TaskFormModal, type NewTaskDefaults } from './TaskFormModal'
import { TaskDrawer } from './TaskDrawer'
import { Avatar, memberColorIndex } from './ui'

export function Layout({ children }: { children: ReactNode }) {
  const { me, other, tasks, members, workspace, workspaces, switchWorkspace, isMine } = useWs()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const loc = useLocation()
  const [newOpen, setNewOpen] = useState(false)
  const [newDefaults, setNewDefaults] = useState<NewTaskDefaults | undefined>()
  const [menuOpen, setMenuOpen] = useState(false)
  const taskId = params.get('t')

  const openTask = useCallback((id: string) => {
    const p = new URLSearchParams(window.location.search); p.set('t', id); setParams(p)
  }, [setParams])
  const closeTask = useCallback(() => {
    const p = new URLSearchParams(window.location.search); p.delete('t'); setParams(p)
  }, [setParams])
  const openNew = useCallback((d?: NewTaskDefaults) => { setNewDefaults(d); setNewOpen(true) }, [])

  useEffect(() => setMenuOpen(false), [loc.pathname])
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); openNew() }
      if (e.key === 'q' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); openNew({ mode: 'quick' }) }
      if (e.key === '/') { e.preventDefault(); document.getElementById('global-search')?.focus() }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [openNew])

  const counts = useMemo(() => {
    const open = tasks.filter(isOpen)
    return {
      all: open.length,
      mine: open.filter(t => isMine(t, me.id)).length,
      other: other ? open.filter(t => isMine(t, other.user_id)).length : 0,
      bold: open.filter(t => t.category === 'the_bold').length,
      waiting: open.filter(t => t.status === 'aguardando').length,
      triage: open.filter(t => t.needs_triage).length,
    }
  }, [tasks, me.id, other, isMine])

  const otherLabel = other ? `Pendências da ${firstName(other.profile.name)}` : 'Pendências da equipe'
  const nav = [
    { to: '/', label: 'Dashboard', icon: Home, end: true },
    { to: '/pendencias', label: 'Todas as pendências', icon: ListTodo, count: counts.all },
    { to: '/minhas', label: 'Minhas pendências', icon: User, count: counts.mine },
    { to: '/outra', label: otherLabel, icon: Users, count: counts.other },
    { to: '/the-bold', label: 'The Bold', icon: Building2, count: counts.bold },
    { to: '/aguardando', label: 'Aguardando', icon: Clock3, count: counts.waiting },
    { to: '/a-classificar', label: 'A classificar', icon: Inbox, count: counts.triage, hideIfZero: true },
    { to: '/calendario', label: 'Calendário', icon: CalendarDays },
    { to: '/historico', label: 'Histórico', icon: History },
  ]

  const sidebar = (
    <nav className="flex h-full flex-col" aria-label="Menu principal">
      <div className="px-6 pt-7 pb-8">
        <div className="font-serif text-[1.65rem] font-bold tracking-tight text-off leading-none">BOLD</div>
        <div className="font-accent italic text-xl text-off/70 -mt-0.5">tasks</div>
      </div>
      <ul className="flex-1 space-y-0.5 px-3">
        {nav.filter(n => !(n.hideIfZero && !n.count)).map(n => (
          <li key={n.to}>
            <NavLink to={n.to} end={n.end} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] transition ${isActive ? 'bg-off/10 text-off' : 'text-off/65 hover:bg-off/5 hover:text-off'}`}>
              <n.icon size={17} strokeWidth={1.6} />
              <span className="flex-1 truncate">{n.label}</span>
              {!!n.count && <span className={`text-xs tabular-nums ${n.to === '/a-classificar' ? 'rounded-full bg-[#e8dcc3] px-1.5 text-bordo font-semibold' : 'text-off/50'}`}>{n.count}</span>}
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="border-t border-off/10 p-3 space-y-0.5">
        {workspaces.length > 1 && (
          <select aria-label="Workspace" className="mb-2 w-full rounded-xl border border-off/15 bg-transparent px-3 py-2 text-sm text-off/80" value={workspace.id} onChange={e => { switchWorkspace(e.target.value); navigate('/') }}>
            {workspaces.map(w => <option key={w.id} value={w.id} className="text-ink">{w.name}</option>)}
          </select>
        )}
        <NavLink to="/configuracoes" className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${isActive ? 'bg-off/10 text-off' : 'text-off/65 hover:text-off'}`}><Settings size={17} strokeWidth={1.6} />Configurações</NavLink>
        <div className="flex items-center gap-3 px-3 py-2.5">
          <Avatar name={me.name} idx={memberColorIndex(members, me.id) === 0 ? 1 : 0} size={30} />
          <div className="min-w-0 flex-1"><div className="truncate text-sm text-off">{me.name}</div><div className="truncate text-[11px] text-off/50">{workspace.name}</div></div>
          <button aria-label="Sair" title="Sair" className="text-off/60 hover:text-off" onClick={() => supabase.auth.signOut()}><LogOut size={17} /></button>
        </div>
      </div>
    </nav>
  )

  return (
    <UIContext.Provider value={{ openTask, openNew }}>
      <div className="flex min-h-full">
        <aside className="fixed inset-y-0 left-0 hidden w-64 bg-bordo lg:block">{sidebar}</aside>
        {menuOpen && (
          <div className="fixed inset-0 z-[58] bg-ink/40 lg:hidden fade-in" onClick={() => setMenuOpen(false)}>
            <aside className="h-full w-72 bg-bordo slide-in" onClick={e => e.stopPropagation()}>
              <button className="absolute right-4 top-6 text-off/70" onClick={() => setMenuOpen(false)} aria-label="Fechar menu"><X /></button>
              {sidebar}
            </aside>
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
          <header className="sticky top-0 z-40 flex items-center gap-2 md:gap-3 border-b border-line bg-off/90 px-4 md:px-8 py-3 backdrop-blur">
            <button className="lg:hidden -ml-1 p-1.5" onClick={() => setMenuOpen(true)} aria-label="Abrir menu"><Menu size={22} /></button>
            <span className="lg:hidden font-serif font-bold text-lg text-bordo mr-1">BOLD</span>
            <GlobalSearch />
            <NotificationBell />
            <button className="btn btn-primary hidden md:inline-flex" onClick={() => openNew()} data-testid="new-task"><Plus size={16} />Nova pendência</button>
          </header>
          <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 md:px-8 py-6 md:py-10 pb-28">{children}</main>
        </div>
        {/* botão permanente de adição */}
        <button aria-label="Nova pendência" onClick={() => openNew()} className="fixed bottom-6 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-bordo text-off shadow-xl md:hidden" data-testid="fab-new">
          <Plus size={26} />
        </button>
      </div>
      <TaskFormModal open={newOpen} onClose={() => setNewOpen(false)} defaults={newDefaults} />
      {taskId && <TaskDrawer taskId={taskId} onClose={closeTask} />}
    </UIContext.Provider>
  )
}

function GlobalSearch() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const loc = useLocation()
  const [q, setQ] = useState(loc.pathname === '/pendencias' ? params.get('q') ?? '' : '')
  useEffect(() => { if (loc.pathname !== '/pendencias') setQ('') }, [loc.pathname])
  return (
    <form className="relative flex-1 max-w-xl" role="search" onSubmit={e => {
      e.preventDefault()
      const p = new URLSearchParams(); if (q.trim()) p.set('q', q.trim()); p.set('status', '')
      navigate(`/pendencias?${p.toString()}`)
    }}>
      <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-mute" />
      <input id="global-search" aria-label="Busca global" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar pendências…  /"
        className="w-full rounded-full border border-line bg-paper py-2 pl-10 pr-4 text-sm outline-none focus:border-bordo" />
    </form>
  )
}

function NotificationBell() {
  const { notifications, markRead, markAllRead, memberName } = useWs()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const [, setParams] = useSearchParams()
  const unread = notifications.filter(n => !n.is_read).length
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])
  return (
    <div className="relative" ref={ref}>
      <button aria-label={`Notificações${unread ? ` (${unread} não lidas)` : ''}`} data-testid="bell" onClick={() => setOpen(o => !o)} className="relative rounded-full p-2 hover:bg-paper">
        <Bell size={20} strokeWidth={1.7} />
        {unread > 0 && <span data-testid="bell-count" className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-bordo px-1 text-[10px] font-bold text-off">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className="fade-in fixed md:absolute left-3 right-3 md:left-auto md:right-0 top-16 md:top-12 z-50 md:w-[400px] overflow-hidden rounded-2xl border border-line bg-paper shadow-2xl" data-testid="notif-panel">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="font-serif text-lg">Notificações</span>
            {unread > 0 && <button className="text-xs text-bordo hover:underline" onClick={markAllRead}>Marcar todas como lidas</button>}
          </div>
          <ul className="max-h-[60vh] overflow-y-auto">
            {notifications.length === 0 && <li className="px-4 py-10 text-center text-sm text-mute">Nenhuma notificação.</li>}
            {notifications.map(n => (
              <li key={n.id} data-testid="notif-item">
                <button className={`flex w-full gap-3 px-4 py-3 text-left hover:bg-off ${n.is_read ? 'opacity-60' : ''}`} onClick={() => {
                  markRead(n.id); setOpen(false)
                  if (n.task_id) { const p = new URLSearchParams(window.location.search); p.set('t', n.task_id); setParams(p) }
                }}>
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.is_read ? 'bg-transparent' : 'bg-bordo'}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold">{n.title}</span>
                    <span className="block truncate text-sm">{n.message}</span>
                    <span className="block text-xs text-mute">{n.actor_id ? `${firstName(memberName(n.actor_id))} · ` : ''}{timeAgo(n.created_at)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
