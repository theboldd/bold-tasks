export type Status = 'a_fazer' | 'em_andamento' | 'aguardando' | 'concluida'
export type Priority = 'alta' | 'normal' | 'baixa'
export type Category = 'the_bold' | 'pessoal'
export type TimeWindow = 'manha' | 'tarde' | 'fim_do_dia'

export interface Profile { id: string; name: string; email: string; avatar_url: string | null }
export interface Workspace { id: string; name: string; slug: string }
export interface Member { user_id: string; role: string; profile: Profile }

export interface Task {
  id: string
  seq: number
  workspace_id: string
  title: string
  description: string | null
  created_by: string
  assigned_to: string | null
  category: Category | null
  category_owner: string | null
  status: Status
  priority: Priority
  due_date: string | null
  needs_triage: boolean
  scheduled_date: string | null
  due_time: string | null
  time_window: TimeWindow | null
  is_shared: boolean
  rollover_count: number
  completed_at: string | null
  completed_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface Comment { id: string; task_id: string; user_id: string; content: string; created_at: string }
export interface Activity {
  id: string; task_id: string; workspace_id: string; user_id: string | null
  action: string; field: string | null; old_value: string | null; new_value: string | null; created_at: string
}
export interface Notification {
  id: string; workspace_id: string; recipient_id: string; actor_id: string | null; task_id: string | null
  type: string; title: string; message: string | null; is_read: boolean; created_at: string
}

export type TaskPatch = Partial<Pick<Task, 'title' | 'description' | 'assigned_to' | 'category' | 'category_owner' | 'status' | 'priority' | 'due_date' | 'needs_triage' | 'scheduled_date' | 'due_time' | 'time_window' | 'is_shared'>>
export interface TaskPart { task_id: string; user_id: string; workspace_id: string; completed_at: string | null }
export interface CalEvent { owner_id: string; title: string; start: string; end: string; all_day: boolean; busy_only: boolean }
