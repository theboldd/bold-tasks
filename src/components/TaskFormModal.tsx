import { useEffect, useRef, useState } from 'react'
import { Zap } from 'lucide-react'
import { Modal } from './ui'
import { useToast, useWs } from '../lib/store'
import { PRIORITY, STATUS } from '../lib/labels'
import { categoryOptions, decodeCategory } from '../lib/filters'
import type { Priority, Status } from '../lib/types'

export interface NewTaskDefaults { assigned_to?: string; category?: string; status?: Status; due_date?: string; mode?: 'full' | 'quick' }

export function TaskFormModal({ open, onClose, defaults, onCreated }: { open: boolean; onClose: () => void; defaults?: NewTaskDefaults; onCreated?: (id: string) => void }) {
  const { members, createTask, quickCapture } = useWs()
  const toast = useToast()
  const [mode, setMode] = useState<'full' | 'quick'>('full')
  const [title, setTitle] = useState('')
  const [assigned, setAssigned] = useState('')
  const [category, setCategory] = useState('the_bold')
  const [due, setDue] = useState('')
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
    setAssigned(defaults?.assigned_to ?? '')
    setCategory(defaults?.category ?? 'the_bold')
    setDue(defaults?.due_date ?? '')
    setPriority('normal')
    setStatus(defaults?.status ?? 'a_fazer')
    setTimeout(() => firstRef.current?.focus(), 30)
  }, [open, defaults])

  useEffect(() => { if (open) setTimeout(() => firstRef.current?.focus(), 30) }, [mode, open])

  async function submitFull(e: React.FormEvent) {
    e.preventDefault()
    setTried(true)
    if (!title.trim() || !assigned || !category) return
    setSaving(true)
    const t = await createTask({
      title: title.trim(), assigned_to: assigned, ...decodeCategory(category),
      due_date: due || null, priority, status, description: description.trim() || null,
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

  const err = (cond: boolean) => tried && cond ? 'border-late' : ''

  return (
    <Modal open={open} onClose={onClose} title="Nova pendência">
      <div className="mb-5 inline-flex rounded-full border border-line bg-off p-1 text-sm" role="tablist">
        <button role="tab" aria-selected={mode === 'full'} className={`rounded-full px-4 py-1.5 ${mode === 'full' ? 'bg-paper shadow-sm font-medium' : 'text-mute'}`} onClick={() => setMode('full')}>Cadastro</button>
        <button role="tab" aria-selected={mode === 'quick'} className={`rounded-full px-4 py-1.5 inline-flex items-center gap-1.5 ${mode === 'quick' ? 'bg-paper shadow-sm font-medium' : 'text-mute'}`} onClick={() => setMode('quick')}><Zap size={14} />Adicionar rapidamente</button>
      </div>

      {mode === 'quick' ? (
        <form onSubmit={submitQuick} className="space-y-4">
          <textarea ref={el => { firstRef.current = el }} aria-label="Texto da captura" className="field min-h-28 text-base" placeholder="Ex.: Rebeca precisa aprovar a proposta do cliente até sexta."
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
            <input id="nt-title" ref={el => { firstRef.current = el }} className={`field text-base ${err(!title.trim())}`} value={title} onChange={e => setTitle(e.target.value)} placeholder="O que precisa ser feito?" maxLength={300} />
          </div>
          <div>
            <span className="eyebrow mb-1.5 block">Responsável *</span>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Responsável">
              {members.map(m => (
                <button type="button" role="radio" aria-checked={assigned === m.user_id} key={m.user_id} onClick={() => setAssigned(m.user_id)}
                  className={`rounded-full border px-4 py-1.5 text-sm transition ${assigned === m.user_id ? 'border-bordo bg-bordo text-off' : `border-line bg-paper hover:border-ink ${tried && !assigned ? 'border-late' : ''}`}`}>
                  {m.profile.name}
                </button>
              ))}
            </div>
            {tried && !assigned && <p className="mt-1 text-xs text-late">Selecione quem vai executar.</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="eyebrow mb-1.5 block" htmlFor="nt-cat">Categoria *</label>
              <select id="nt-cat" className="field" value={category} onChange={e => setCategory(e.target.value)}>
                {categoryOptions(members).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="eyebrow mb-1.5 block" htmlFor="nt-due">Prazo</label>
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
