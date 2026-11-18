import { dayLabel, formatDue, priorityLabel, statusLabel } from './labels'
import type { Activity } from './types'

type NameFn = (id: string | null | undefined) => string
const first = (s: string) => s.split(' ')[0]

function catLabel(v: string | null, name: NameFn) {
  if (!v) return 'sem categoria'
  if (v.startsWith('the_bold')) return 'The Bold'
  if (v.startsWith('pessoal:')) return `Pessoal — ${first(name(v.slice(8)))}`
  return v
}

export function describeActivity(a: Activity, name: NameFn): string {
  switch (a.action) {
    case 'created': return 'criou a pendência'
    case 'captured': return 'registrou uma captura rápida'
    case 'classified': return 'classificou a captura'
    case 'completed': return 'concluiu a pendência'
    case 'reopened': return 'reabriu a pendência'
    case 'deleted': return 'excluiu a pendência'
    case 'commented': return 'comentou'
    case 'rolled_over': return `transferiu automaticamente para ${dayLabel(a.new_value).toLowerCase()} (não foi concluída no dia ${a.old_value ? formatDue(a.old_value) : ''})`
    case 'part_completed': return 'concluiu a parte dela'
    case 'part_reopened': return 'reabriu a parte dela'
    case 'updated':
      switch (a.field) {
        case 'title': return `renomeou para “${a.new_value}”`
        case 'description': return 'editou a descrição'
        case 'priority': return `alterou a prioridade: ${priorityLabel(a.old_value ?? '')} → ${priorityLabel(a.new_value ?? '')}`
        case 'status': return `alterou o status: ${statusLabel(a.old_value ?? '')} → ${statusLabel(a.new_value ?? '')}`
        case 'assigned_to': return a.old_value
          ? `passou a responsabilidade de ${first(name(a.old_value))} para ${first(name(a.new_value))}`
          : `atribuiu a ${first(name(a.new_value))}`
        case 'due_date': return a.new_value
          ? `alterou o prazo${a.old_value ? ` de ${formatDue(a.old_value)}` : ''} para ${formatDue(a.new_value)}`
          : 'removeu o prazo'
        case 'category': return `alterou a categoria para ${catLabel(a.new_value, name)}`
        case 'scheduled_date': return `mudou o dia para fazer para ${dayLabel(a.new_value).toLowerCase()}`
        case 'due_time': return a.new_value ? `definiu o horário: ${a.new_value}` : 'removeu o horário'
        case 'shared': return a.new_value === 'true' ? 'tornou a pendência das duas' : 'deixou de ser pendência das duas'
      }
      return 'editou a pendência'
  }
  return a.action
}
