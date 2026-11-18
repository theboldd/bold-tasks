import { useEffect, useRef, useState } from 'react'
import { Zap } from 'lucide-react'
import { Modal } from './ui'
import { useToast, useWs } from '../lib/store'
import { PRIORITY, STATUS, todayISO } from '../lib/labels'
import { TimeField, type TimeValue } from './TimeField'
import { categoryOptions, decodeCategory } from '../lib/filters'
import type { Priority, Status } from '../lib/types'
import { AssigneePicker, assignHint } from './AssigneePicker'
import { assignToPatch, assignValid, type Assign } from '../lib/assign'

export interface NewTaskDefaults { assigned_to?: string; team?: boolean; category?: string; status?: Status; due_date?: string; scheduled_date?: string; due_time?: string; mode?: 'full' | 'quick' }

export function TaskFormModal({ open, onClose, defaults, onCreated }: { open: boolean; onClose: () => void; defaults?: NewTaskDefaults; onCreated?: (id: string) => void }) {
  const { members, createTask, quickCapture } = useWs()
  const toast = useToast()
  const [mode, setMode] = useState<'full' | 'quick'>('full')
  const [title, setTitle] = useState('')
  const [assigned, setAssigned] = useState<Assign>({ people: [], team: false })
  const [category, setCategory] = useState('the_bold')
  const [due, setDue] = useState('')
  const [day, setDay] = useState(todayISO())
  const [time, setTime] = useState<TimeValue>({ due_time: null, time_window: null })
  const [priority, setPriority] = useState<Priority>('normal')
  const [status, setStatus] = useState<Status>('a_fazer')
  const [description, setDescription] = useState('')
  const [quick, setQuick] = useState('')
  const [saving, setSaving] = useState(false)
  const [tried, setTried] = useState(false)
  const firstRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (!open) return
    setMode(defaults?.mode ?? 'full')
    setTitle(''); setDescription(''); setQuick(''); setTried(false)
    setAssigned({ people: defaults?.assigned_to === 'both' ? members.map(m => m.user_id) : defaults?.assigned_to ? [defaults.assigned_to] : [], team: !!defaults?.team })
    setCategory(defaults?.category ?? 'the_bold')
    setDue(defaults?.due_date ?? '')
    setDay(defaults?.scheduled_date ?? todayISO())
    setTime({ due_time: defaults?.due_time ?? null, time_window: null })
    setPriority('normal')
    setStatus(defaults?.status ?? 'a_fazer')
    setTimeout(() => firstRef.current?.focus(), 30)
  }, [open, defaults])

  useEffect(() => { if (open) setTimeout(() => firstRef.current?.focus(), 30) }, [mode, open])

  async function submitFull(e: React.FormEvent) {
    e.preventDefault()
    setTried(true)
    if (!title.trim() || !assignValid(assigned) || !category) return
    setSaving(true)
    const t = await createTask({
      title: title.trim(), ...assignToPatch(assigned), ...decodeCategory(category),
      due_date: due || null, scheduled_date: day || todayISO(), ...time,
      priority, status, description: description.trim() || null,
    })
    setSaving(false)
    if (t) { toast('Pendência criada'); onClose(); onCreated?.(t.id) }
  }
  async function submitQuick(e: React.FormEvent) {
    e.preventDefault()
    if (!quick.trim()) return
    setSaving(true)
    const id = await quickCapture(quick.trim())
    setSaving(false)
    if (id) { toast('Captura registrada em “A classificar”'); onClose() }
  }

  
  return (
    <Modal open={open} onClose={onClose} title="Nova pendência">
      <div className="mb-6 flex gap-6 border-b border-line text-[13px]" role="tablist">
        <button role="tab" aria-selected={mode === 'full'} className={`-mb-px border-b-2 pb-2.5 transition ${mode === 'full' ? 'border-bordo text-ink' : 'border-transparent text-mute hover:text-ink'}`} onClick={() => setMode('full')}>Cadastro</button>
        <button role="tab" aria-selected={mode === 'quick'} className={`-mb-px inline-flex items-center gap-1.5 border-b-2 pb-2.5 transition ${mode === 'quick' ? 'border-bordo text-ink' : 'border-transparent text-mute hover:text-ink'}`} onClick={() => setMode('quick')}><Zap size={13} strokeWidth={1.6} />Adicionar rapidamente</button>
      </div>

      {mode === 'quick' ? (
        <form onSubmit={submitQuick} className="space-y-4">
          <textarea ref={el => { firstRef.current = el }} aria-label="Texto da captura" className="w-full resize-none border-0 border-b border-ink bg-transparent pb-3 font-serif text-[1.6rem] leading-snug outline-none placeholder:text-mute/60 min-h-32" placeholder="Ex.: Rebeca precisa aprovar a proposta do cliente até sexta."
            value={quick} onChange={e => setQuick(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitQuick(e) }} />
          <p className="text-xs text-mute">Fica registrada como <strong className="text-wait">A classificar</strong>. Depois você completa responsável, categoria, prazo e prioridade.</p>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" disabled={saving || !quick.trim()}>{saving ? 'Salvando…' : 'Registrar captura'}</button>
          </div>
        </form>
      ) : (
        <form onSubmit={submitFull} className="space-y-4">
          <div>
            <label className="eyebrow mb-1.5 block" htmlFor="nt-title">Título *</label>
            <input id="nt-title" ref={el => { firstRef.current = el }} className={`w-full border-0 border-b bg-transparent pb-2 font-serif text-[1.7rem] leading-tight outline-none placeholder:text-mute/50 focus:border-bordo ${tried && !title.trim() ? 'border-late' : 'border-ink'}`} value={title} onChange={e => setTitle(e.target.value)} placeholder="O que precisa ser feito?" maxLength={300} />
          </div>
          <div>
            <span className="eyebrow mb-1.5 block">Responsáveis * <span className="normal-case tracking-normal text-mute/80">(pode marcar mais de um)</span></span>
            <AssigneePicker value={assigned} onChange={setAssigned} members={members} invalid={tried && !assignValid(assigned)} />
            {tried && !assignValid(assigned) && <p className="mt-1 text-xs text-late">Selecione quem vai executar.</p>}
            {assignHint(assigned, members.length) && <p className="mt-1 text-xs text-mute">{assignHint(assigned, members.length)}</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="eyebrow mb-1.5 block" htmlFor="nt-cat">Categoria *</label>
              <select id="nt-cat" className="field" value={category} onChange={e => setCategory(e.target.value)}>
                {categoryOptions(members).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="eyebrow mb-1.5 block" htmlFor="nt-day">Dia para fazer</label>
              <input id="nt-day" type="date" className="field" value={day} onChange={e => setDay(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <span className="eyebrow mb-1.5 block">Até que horas</span>
              <TimeField value={time} onChange={setTime} idPrefix="nt" />
            </div>
            <div>
              <label className="eyebrow mb-1.5 block" htmlFor="nt-due">Prazo final</label>
              <input id="nt-due" type="date" className="field" value={due} onChange={e => setDue(e.target.value)} />
            </div>
            <div>
              <label className="eyebrow mb-1.5 block" htmlFor="nt-pri">Prioridade</label>
              <select id="nt-pri" className="field" value={priority} onChange={e => setPriority(e.target.value as Priority)}>
                {PRIORITY.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="eyebrow mb-1.5 block" htmlFor="nt-status">Status</label>
              <select id="nt-status" className="field" value={status} onChange={e => setStatus(e.target.value as Status)}>
                {STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="eyebrow mb-1.5 block" htmlFor="nt-desc">Descrição</label>
            <textarea id="nt-desc" className="field min-h-20" value={description} onChange={e => setDescription(e.target.value)} placeholder="Contexto, links, detalhes (opcional)" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" disabled={saving}>{saving ? 'Salvando…' : 'Criar pendência'}</button>
          </div>
        </form>
      )}
    </Modal>
  )
}
