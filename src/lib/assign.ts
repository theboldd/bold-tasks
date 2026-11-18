import type { Task, TaskPatch } from './types'

/** Atribuição múltipla: Rebeca, Vitória e/ou The Bold (equipe). */
export interface Assign { people: string[]; team: boolean }

export const assignFromTask = (t: Pick<Task, 'assigned_to' | 'is_shared' | 'is_team'>, memberIds: string[]): Assign => ({
  people: t.is_shared ? memberIds : t.assigned_to ? [t.assigned_to] : [],
  team: !!t.is_team,
})

export const assignValid = (a: Assign) => a.people.length > 0 || a.team

export function assignToPatch(a: Assign): Pick<TaskPatch, 'assigned_to' | 'is_shared' | 'is_team'> {
  if (a.people.length >= 2) return { is_shared: true, assigned_to: null, is_team: a.team }
  if (a.people.length === 1) return { is_shared: false, assigned_to: a.people[0], is_team: a.team }
  return { is_shared: false, assigned_to: null, is_team: a.team }
}

/** Pendência só da equipe (sem pessoa definida). */
export const isTeamOnly = (t: Pick<Task, 'assigned_to' | 'is_shared' | 'is_team'>) => t.is_team && !t.is_shared && !t.assigned_to
