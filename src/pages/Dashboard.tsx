import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Inbox, Plus, Zap } from 'lucide-react'
import { useWs } from '../lib/store'
import { useUI } from '../lib/ui'
import { supabase } from '../lib/supabase'
import { PRIORITY_RANK, addDaysISO, firstName, isDueToday, isOpen, isOverdue, timeAgo, todayISO, weekStartISO } from '../lib/labels'
import { describeActivity } from '../lib/activity'
import type { Activity, Task } from '../lib/types'
import { MiniTask } from '../components/TaskViews'
import { Avatar, memberColorIndex, Spinner } from '../components/ui'

function attentionSort(a: Task, b: Task) {
  const today = todayISO()
  const score = (t: Task) => (isOverdue(t, today) ? 0 : isDueToday(t, today) ? 1 : t.priority === 'alta' ? 2 : t.status === 'em_andamento' ? 3 : 4)
  return score(a) - score(b) || (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
}

export function Dashboard() {
  const { me, other, tasks, tasksLoaded, workspace, memberName, members } = useWs()
  const { openNew, openTask } = useUI()
  const [activity, setActivity] = useState<Activity[]>([])
  const today = todayISO()

  useEffect(() => {
    const load = () => supabase.from('task_activity').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(12)
      .then(({ data }) => setActivity((data ?? []) as Activity[]))
    load()
    const ch = supabase.channel(`dash-act-${workspace.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'task_activity', filter: `workspace_id=eq.${workspace.id}` }, p => setActivity(prev => [p.new as Activity, ...prev].slice(0, 12)))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [workspace.id])

  const s = useMemo(() => {
    const open = tasks.filter(isOpen)
    const ws = weekStartISO(today)
    return {
      open: open.length,
      mine: open.filter(t => t.assigned_to === me.id),
      other: other ? open.filter(t => t.assigned_to === other.user_id) : [],
      overdue: open.filter(t => isOverdue(t, today)),
      today: open.filter(t => isDueToday(t, today)),
      waiting: open.filter(t => t.status === 'aguardando'),
      triage: open.filter(t => t.needs_triage),
      doneWeek: tasks.filter(t => t.status === 'concluida' && t.completed_at && todayISO(new Date(t.completed_at)) >= ws).length,
      upcoming: open.filter(t => t.due_date && t.due_date >= today && t.due_date <= addDaysISO(today, 7)).sort((a, b) => a.due_date!.localeCompare(b.due_date!)),
    }
  }, [tasks, me.id, other, today])

  if (!tasksLoaded) return <Spinner />

  const hour = Number(new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hour12: false, timeZone: 'America/Sao_Paulo' }).format(new Date()))
  const greet = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
  const otherName = other ? firstName(other.profile.name) : 'Equipe'
  const kpis = [
    { label: 'Abertas', value: s.open, to: '/pendencias' },
    { label: `Com ${firstName(me.name)}`, value: s.mine.length, to: '/minhas' },
    { label: `Com ${otherName}`, value: s.other.length, to: '/outra' },
    { label: 'Atrasadas', value: s.overdue.length, to: '/pendencias?overdue=1', tone: s.overdue.length ? 'late' : '' },
    { label: 'Para hoje', value: s.today.length, to: '/pendencias?due=today' },
    { label: 'Aguardando retorno', value: s.waiting.length, to: '/aguardando' },
    { label: 'Concluídas na semana', value: s.doneWeek, to: '/pendencias?status=concluida&sort=created', tone: 'ok' },
  ]

  return (
    <div>
      <div className="mb-8 md:mb-10">
        <div className="eyebrow mb-2">{new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' }).format(new Date())}</div>
        <h1 className="font-serif text-3xl md:text-[2.8rem] leading-[1.05] tracking-tight">{greet}, <span className="font-accent italic font-normal text-bordo">{firstName(me.name)}</span>.</h1>
        <p className="mt-3 text-mute max-w-xl">
          {s.overdue.length || s.today.length
            ? <>Você tem <strong className="text-ink">{s.mine.filter(t => isOverdue(t, today)).length} atrasada(s)</strong> e <strong className="text-ink">{s.mine.filter(t => isDueToday(t, today)).length} para hoje</strong> sob sua responsabilidade.</>
            : 'Nada atrasado nem vencendo hoje. Bom momento para adiantar as próximas.'}
        </p>
      </div>

      {/* 1. visão geral */}
      <section aria-label="Visão geral do trabalho" className="mb-8 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-px overflow-hidden rounded-2xl border border-line bg-line">
        {kpis.map(k => (
          <Link key={k.label} to={k.to} className="bg-paper p-4 md:p-5 hover:bg-off/60 transition" data-testid={`kpi-${k.label}`}>
            <div className={`font-sans text-3xl md:text-[2.2rem] font-light tabular-nums leading-none ${k.tone === 'late' ? 'text-late' : k.tone === 'ok' ? 'text-ok' : 'text-ink'}`}>{k.value}</div>
            <div className="mt-2 text-xs text-mute leading-tight">{k.label}</div>
          </Link>
        ))}
      </section>

      {(s.triage.length > 0 || s.overdue.length > 0) && (
        <div className="mb-8 grid gap-3 md:grid-cols-2">
          {s.overdue.length > 0 && (
            <Link to="/pendencias?overdue=1" className="flex items-center gap-3 rounded-2xl border border-[#ecd2cc] bg-late-50 px-4 py-3 text-sm text-late">
              <AlertTriangle size={17} /> <span className="flex-1"><strong>{s.overdue.length}</strong> pendência(s) atrasada(s) no workspace</span><ArrowRight size={15} />
            </Link>
          )}
          {s.triage.length > 0 && (
            <Link to="/a-classificar" className="flex items-center gap-3 rounded-2xl border border-[#e8dcc3] bg-wait-50 px-4 py-3 text-sm text-wait">
              <Inbox size={17} /> <span className="flex-1"><strong>{s.triage.length}</strong> captura(s) aguardando classificação</span><ArrowRight size={15} />
            </Link>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 2. minhas prioridades */}
        <section className="card p-5 lg:col-span-2" aria-label="Minhas prioridades">
          <SectionHead title="Minhas prioridades" to="/minhas" />
          {s.mine.length ? <ul className="divide-y divide-line">{[...s.mine].sort(attentionSort).slice(0, 7).map(t => <MiniTask key={t.id} task={t} />)}</ul>
            : <p className="py-6 text-sm text-mute">Nenhuma pendência aberta com você.</p>}
        </section>

        {/* 6. ações rápidas */}
        <section className="card p-5" aria-label="Ações rápidas">
          <SectionHead title="Ações rápidas" />
          <div className="flex flex-col gap-2">
            <button className="btn btn-primary justify-center" onClick={() => openNew()}><Plus size={16} />Nova pendência</button>
            <button className="btn btn-ghost justify-center" onClick={() => openNew({ mode: 'quick' })}><Zap size={15} />Adicionar rapidamente</button>
            {other && <button className="btn btn-ghost justify-center" onClick={() => openNew({ assigned_to: other.user_id })}>Atribuir para {otherName}</button>}
          </div>
          <p className="mt-4 text-xs text-mute">Atalhos: <kbd className="rounded border border-line px-1">N</kbd> nova · <kbd className="rounded border border-line px-1">Q</kbd> captura · <kbd className="rounded border border-line px-1">/</kbd> busca</p>
        </section>

        {/* 3. pendências da outra */}
        <section className="card p-5 lg:col-span-2" aria-label={`Pendências da ${otherName}`}>
          <SectionHead title={`Pendências da ${otherName}`} to="/outra" />
          {s.other.length ? <ul className="divide-y divide-line">{[...s.other].sort(attentionSort).slice(0, 6).map(t => <MiniTask key={t.id} task={t} />)}</ul>
            : <p className="py-6 text-sm text-mute">Nenhuma pendência aberta com {otherName}.</p>}
        </section>

        {/* 4. próximos prazos */}
        <section className="card p-5" aria-label="Próximos prazos">
          <SectionHead title="Próximos 7 dias" to="/calendario" />
          {s.upcoming.length ? <ul className="divide-y divide-line">{s.upcoming.slice(0, 7).map(t => <MiniTask key={t.id} task={t} />)}</ul>
            : <p className="py-6 text-sm text-mute">Sem prazos na próxima semana.</p>}
        </section>

        {/* 5. últimas atualizações */}
        <section className="card p-5 lg:col-span-3" aria-label="Últimas atualizações">
          <SectionHead title="Últimas atualizações" to="/historico" />
          {activity.length ? (
            <ul className="grid gap-x-8 md:grid-cols-2">
              {activity.map(a => {
                const t = tasks.find(x => x.id === a.task_id)
                return (
                  <li key={a.id} className="flex items-start gap-3 border-b border-line py-3 text-sm">
                    <Avatar name={a.user_id ? memberName(a.user_id) : 'Sistema'} idx={memberColorIndex(members, a.user_id)} size={24} />
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold">{a.user_id ? firstName(memberName(a.user_id)) : 'Sistema'}</span> {describeActivity(a, memberName)}
                      {t ? <button className="block max-w-full truncate text-left text-mute hover:text-bordo" onClick={() => openTask(t.id)}>{t.title}</button> : <span className="block text-mute">(pendência excluída)</span>}
                    </div>
                    <span className="shrink-0 text-xs text-mute">{timeAgo(a.created_at)}</span>
                  </li>
                )
              })}
            </ul>
          ) : <p className="py-6 text-sm text-mute">Ainda não há atividade.</p>}
        </section>
      </div>
    </div>
  )
}

function SectionHead({ title, to }: { title: string; to?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 className="font-serif text-xl">{title}</h2>
      {to && <Link to={to} className="text-xs text-mute hover:text-bordo">Ver tudo →</Link>}
    </div>
  )
}
