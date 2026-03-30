export const ALARM_TYPES = [
  'label_change_soon',
  'team_label_change_soon',
] as const

export type AlarmType = (typeof ALARM_TYPES)[number]

export const ALARM_SEVERITIES = ['info', 'warning', 'critical'] as const

export type AlarmSeverity = (typeof ALARM_SEVERITIES)[number]

export interface Alarm {
  id: number
  user_id: string
  user_email: string
  alarm_type: AlarmType
  severity: AlarmSeverity
  title: string
  description: string | null
  ws_task_id: string | null
  ws_task_name: string | null
  ws_task_url: string | null
  ws_project_id: string | null
  details: Record<string, unknown>
  alarm_date: string
  is_resolved: boolean
  resolved_at: string | null
  created_at: string
}
