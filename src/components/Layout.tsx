import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Bell, CalendarDays, Monitor, Moon, Sun, Clock3, Home, Inbox, ListTodo, LogOut, Plus, Search, Settings, User, Users, Building2, Menu, X, History } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useWs } from '../lib/store'
import { UIContext } from '../lib/ui'
import { firstName, isOpen, timeAgo } from '../lib/labels'
import { TaskFormModal, type NewTaskDefaults } from './TaskFormModal'
import { TaskDrawer } from './TaskDrawer'
import { Avatar, memberColorIndex } from './ui'
import { useTheme, type ThemePref } from '../lib/theme'

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
      bold: open.filter(t => t.is_team).length,
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
    { to: '/the-bold', label: 'Equipe The Bold', icon: Building2, count: counts.bold },
    { to: '/aguardando', label: 'Aguardando', icon: Clock3, count: counts.waiting },
    { to: '/a-classificar', label: 'A classificar', icon: Inbox, count: counts.triage, hideIfZero: true },
    { to: '/calendario', label: 'Calendário', icon: CalendarDays },
    { to: '/historico', label: 'Histórico', icon: History },
  ]

  const sidebar = (
    <nav className="flex h-full flex-col" aria-label="Menu principal">
      <div className="px-7 pt-8 pb-7">
        <div className="display text-[2.35rem] font-semibold leading-none tracking-tight text-cream">BOLD</div>
        <div className="meta mt-1.5 text-[10px] font-semibold uppercase tracking-[.42em] text-cream/60">Tasks</div>
        <div className="mt-5 h-px w-10 bg-cream/30" />
        <p className="mt-4 max-w-[12rem] text-[12px] leading-relaxed text-cream/50">Central de execução da The Bold.</p>
      </div>
      <ul className="flex-1 overflow-y-auto px-4">
        {nav.filter(n => !(n.hideIfZero && !n.count)).map((n, i) => (
          <li key={n.to}>
            <NavLink to={n.to} end={n.end} className={({ isActive }) => `group relative flex items-center gap-3 py-2.5 pl-4 pr-2 text-[13.5px] transition-colors ${isActive ? 'text-cream' : 'text-cream/55 hover:text-cream'}`}>
              {({ isActive }) => <>
                <span className={`absolute left-0 top-1/2 h-4 w-px -translate-y-1/2 transition-all ${isActive ? 'bg-cream' : 'bg-transparent group-hover:bg-cream/30'}`} />
                <span className="meta w-5 text-[10px] tracking-wider text-cream/35">{String(i + 1).padStart(2, '0')}</span>
                <span className="flex-1 truncate">{n.label}</span>
                {!!n.count && <span className={`meta text-[11px] tabular-nums ${n.to === '/a-classificar' ? 'text-[#e8cfa8] font-semibold' : 'text-cream/45'}`}>{n.count}</span>}
              </>}
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="mx-4 border-t border-cream/15 py-3">
        {workspaces.length > 1 && (
          <select aria-label="Workspace" className="mb-2 w-full border border-cream/15 bg-transparent px-3 py-2 text-[13px] text-cream/80" value={workspace.id} onChange={e => { switchWorkspace(e.target.value); navigate('/') }}>
            {workspaces.map(w => <option key={w.id} value={w.id} className="text-ink">{w.name}</option>)}
          </select>
        )}
        <ThemeSwitch />
        <NavLink to="/configuracoes" className={({ isActive }) => `flex items-center gap-3 py-2 pl-4 text-[13px] ${isActive ? 'text-cream' : 'text-cream/55 hover:text-cream'}`}><Settings size={15} strokeWidth={1.5} />Configurações</NavLink>
        <div className="mt-1 flex items-center gap-3 py-2 pl-3">
          <Avatar name={me.name} idx={memberColorIndex(members, me.id) === 0 ? 1 : 0} size={30} />
          <div className="min-w-0 flex-1"><div className="truncate text-[13px] text-cream">{me.name}</div><div className="meta truncate text-[10px] uppercase tracking-[.16em] text-cream/40">{workspace.name}</div></div>
          <button aria-label="Sair" title="Sair" className="p-1 text-cream/50 hover:text-cream" onClick={() => supabase.auth.signOut()}><LogOut size={16} strokeWidth={1.5} /></button>
        </div>
      </div>
    </nav>
  )

  return (
    <UIContext.Provider value={{ openTask, openNew }}>
      <div className="flex min-h-full">
        <aside className="fixed inset-y-0 left-0 hidden w-[248px] bg-brand lg:block">{sidebar}</aside>
        {menuOpen && (
          <div className="fixed inset-0 z-[58] bg-ink/40 lg:hidden fade-in" onClick={() => setMenuOpen(false)}>
            <aside className="relative h-full w-72 bg-brand slide-in" onClick={e => e.stopPropagation()}>
              <button className="absolute right-4 top-6 text-cream/70" onClick={() => setMenuOpen(false)} aria-label="Fechar menu"><X /></button>
              {sidebar}
            </aside>
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col lg:pl-[248px]">
          <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-line bg-off/92 px-4 md:px-10 py-3 backdrop-blur">
            <button className="lg:hidden -ml-1 p-1.5" onClick={() => setMenuOpen(true)} aria-label="Abrir menu"><Menu size={21} strokeWidth={1.5} /></button>
            <span className="lg:hidden display mr-1 text-xl font-semibold text-bordo">BOLD</span>
            <GlobalSearch />
            <NotificationBell />
            <button className="btn btn-primary hidden md:inline-flex" onClick={() => openNew()} data-testid="new-task"><Plus size={15} strokeWidth={1.8} />Nova pendência</button>
          </header>
          <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 md:px-10 py-7 md:py-12 pb-28">{children}</main>
        </div>
        {/* botão permanente de adição (celular) */}
        <button aria-label="Nova pendência" onClick={() => openNew()} className="fixed bottom-5 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-bordo text-off shadow-[0_12px_30px_-10px_rgba(58,0,0,.6)] transition active:scale-95 md:hidden" data-testid="fab-new">
          <Plus size={24} strokeWidth={1.6} />
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
      <Search size={15} strokeWidth={1.6} className="pointer-events-none absolute left-1 top-1/2 -translate-y-1/2 text-mute" />
      <input id="global-search" aria-label="Busca global" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar pendências"
        className="field-line w-full py-2 pl-7 pr-8 text-[14px]" />
      <kbd className="meta pointer-events-none absolute right-1 top-1/2 hidden -translate-y-1/2 border border-line px-1.5 text-[10px] text-mute md:block">/</kbd>
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
      <button aria-label={`Notificações${unread ? ` (${unread} não lidas)` : ''}`} data-testid="bell" onClick={() => setOpen(o => !o)} className="relative p-2 text-ink/80 transition hover:text-ink">
        <Bell size={19} strokeWidth={1.5} />
        {unread > 0 && <span data-testid="bell-count" className="meta absolute right-0 top-0 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-bordo px-1 text-[9.5px] font-bold text-off">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className="rise-in fixed md:absolute left-3 right-3 md:left-auto md:right-0 top-16 md:top-12 z-50 md:w-[420px] overflow-hidden border border-line bg-paper shadow-[0_24px_60px_-28px_rgba(21,19,19,.45)]" data-testid="notif-panel">
          <div className="flex items-end justify-between border-b border-ink px-5 pt-4 pb-3">
            <div><div className="eyebrow mb-0.5">{unread ? `${unread} não lida${unread > 1 ? 's' : ''}` : 'Em dia'}</div><span className="display text-2xl">Notificações</span></div>
            {unread > 0 && <button className="meta link-edit text-[10.5px] uppercase tracking-[.16em] text-bordo" onClick={markAllRead}>Marcar todas como lidas</button>}
          </div>
          <ul className="max-h-[60vh] overflow-y-auto">
            {notifications.length === 0 && <li className="px-5 py-12 text-center"><div className="display text-xl italic text-bordo">Nada por aqui</div><p className="mt-1 text-sm text-mute">Avisos e lembretes aparecem neste espaço.</p></li>}
            {notifications.map(n => (
              <li key={n.id} data-testid="notif-item">
                <button className={`flex w-full gap-3 border-b border-line px-5 py-3.5 text-left transition hover:bg-off/70 ${n.is_read ? 'opacity-55' : ''}`} onClick={() => {
                  markRead(n.id); setOpen(false)
                  if (n.task_id) { const p = new URLSearchParams(window.location.search); p.set('t', n.task_id); setParams(p) }
                }}>
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.is_read ? 'bg-transparent' : 'bg-bordo'}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-medium leading-snug">{n.title}</span>
                    {n.message && <span className="mt-0.5 block truncate text-[13px] text-mute">{n.message}</span>}
                    <span className="meta mt-1 block text-[10.5px] uppercase tracking-[.12em] text-mute">{n.actor_id ? `${firstName(memberName(n.actor_id))} · ` : ''}{timeAgo(n.created_at)}</span>
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

function ThemeSwitch() {
  const [pref, setPref] = useTheme()
  const opts: { v: ThemePref; label: string; Icon: typeof Sun }[] = [{ v: 'system', label: 'Sistema', Icon: Monitor }, { v: 'light', label: 'Claro', Icon: Sun }, { v: 'dark', label: 'Escuro', Icon: Moon }]
  return (
    <div className="mb-2 ml-4 inline-flex border border-cream/15" role="radiogroup" aria-label="Tema" data-testid="theme-switch">
      {opts.map(({ v, label, Icon }) => (
        <button key={v} role="radio" aria-checked={pref === v} title={label} aria-label={`Tema ${label.toLowerCase()}`} onClick={() => setPref(v)}
          className={`flex h-7 w-8 items-center justify-center transition-colors ${pref === v ? 'bg-cream/15 text-cream' : 'text-cream/45 hover:text-cream'}`}>
          <Icon size={13} strokeWidth={1.6} />
        </button>
      ))}
    </div>
  )
}
