import { Check } from 'lucide-react'
import type { Member } from '../lib/types'
import type { Assign } from '../lib/assign'

/** Seleção múltipla de responsáveis: cada pessoa + The Bold (equipe). */
export function AssigneePicker({ value, onChange, members, invalid, compact }: { value: Assign; onChange: (a: Assign) => void; members: Member[]; invalid?: boolean; compact?: boolean }) {
  const opts = [
    ...members.map(m => ({ key: m.user_id, label: compact ? m.profile.name.split(' ')[0] : m.profile.name, on: value.people.includes(m.user_id),
      toggle: () => onChange({ ...value, people: value.people.includes(m.user_id) ? value.people.filter(x => x !== m.user_id) : [...value.people, m.user_id] }) })),
    { key: 'team', label: 'The Bold', on: value.team, toggle: () => onChange({ ...value, team: !value.team }) },
  ]
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Responsáveis">
      {opts.map(o => (
        <button type="button" key={o.key} aria-pressed={o.on} onClick={o.toggle} data-testid={`assignee-${o.key === 'team' ? 'team' : o.label.split(' ')[0]}`}
          className={`inline-flex items-center gap-1.5 border transition ${compact ? 'px-3 py-1.5 text-[12.5px]' : 'px-4 py-2 text-[13px]'} ${o.on ? 'border-bordo bg-bordo text-off' : `border-line bg-transparent hover:border-ink ${invalid ? 'border-late' : ''}`}`}>
          {o.on && <Check size={13} strokeWidth={2.4} />}{o.label}
        </button>
      ))}
    </div>
  )
}

export function assignHint(a: Assign, n: number) {
  if (a.people.length >= 2 && n >= 2) return 'Cada uma conclui a sua parte. Quando uma termina, a outra é avisada; quando as duas terminam, a pendência fecha.'
  if (!a.people.length && a.team) return 'Pendência da equipe: qualquer uma pode concluir e as duas recebem os lembretes.'
  if (a.team) return 'Também aparece na lista da equipe The Bold.'
  return ''
}
