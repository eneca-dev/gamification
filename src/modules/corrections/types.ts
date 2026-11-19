import { z } from 'zod'

// ============================================================
// Типы корректировок и статусов журнала
// ============================================================

export const correctionTypeValues = ['fix_ws_day', 'fix_revit_day', 'delete_transaction', 'add_transaction'] as const

export type CorrectionType = (typeof correctionTypeValues)[number]

export const correctionTypeLabels: Record<CorrectionType, string> = {
  fix_ws_day: 'Исправить WS-день',
  fix_revit_day: 'Исправить Revit-день',
  delete_transaction: 'Удалить транзакцию',
  add_transaction: 'Добавить транзакцию',
}

export type CorrectionStatus = 'draft' | 'previewed' | 'running' | 'applied' | 'failed' | 'cancelled'

export const correctionStatusLabels: Record<CorrectionStatus, string> = {
  draft: 'Черновик',
  previewed: 'Preview',
  running: 'В работе',
  applied: 'Применено',
  failed: 'Ошибка',
  cancelled: 'Отменено',
}

// ============================================================
// Лог шагов от SQL-функций fn_correction_*
// ============================================================

export type CorrectionStepState = 'planned' | 'done' | 'skip' | 'warn' | 'error'

export interface CorrectionStep {
  n: number
  key: string
  state: CorrectionStepState
  message: string
  data: Record<string, unknown>
}

export type CorrectionLogStatus = 'ok' | 'preview' | 'error'

export interface CorrectionLog {
  status: CorrectionLogStatus
  scenario: CorrectionType
  steps: CorrectionStep[]
  error?: string
}

// ============================================================
// Zod-схемы входных параметров (discriminatedUnion)
// ============================================================

const absenceTypeSchema = z.enum(['vacation', 'sick_leave', 'sick_day', 'day_off'])

export const fixWsDaySchema = z.object({
  correctionType: z.literal('fix_ws_day'),
  targetUserId: z.string().uuid(),
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1),
  mode: z.enum(['green', 'absent', 'red']),
  // Для mode='absent' тип должен быть задан — проверяется в action.
  absenceType: absenceTypeSchema.nullable(),
  reason: z.string().trim().min(3).max(1000),
})

export const fixRevitDaySchema = z.object({
  correctionType: z.literal('fix_revit_day'),
  targetUserId: z.string().uuid(),
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1),
  mode: z.enum(['add', 'remove']),
  pluginName: z.string().trim().min(1).max(100).nullable(),
  reason: z.string().trim().min(3).max(1000),
})

export const deleteTransactionSchema = z.object({
  correctionType: z.literal('delete_transaction'),
  targetUserId: z.string().uuid(),
  transactionId: z.string().uuid(),
  reason: z.string().trim().min(3).max(1000),
})

export const addTransactionSchema = z.object({
  correctionType: z.literal('add_transaction'),
  targetUserId: z.string().uuid(),
  eventType: z.string().min(1).max(100),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  coinsOverride: z.number().int().nullable(),
  description: z.string().trim().max(500).nullable(),
  reason: z.string().trim().min(3).max(1000),
})

export const correctionInputSchema = z.discriminatedUnion('correctionType', [
  fixWsDaySchema,
  fixRevitDaySchema,
  deleteTransactionSchema,
  addTransactionSchema,
])

export type CorrectionInput = z.infer<typeof correctionInputSchema>

// ============================================================
// Доменные типы для UI (чтение)
// ============================================================

export interface CorrectionUserRow {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  name: string
  department: string | null
  team: string | null
  is_admin: boolean
  is_active: boolean
  total_coins: number
  ws_streak: number | null
  revit_streak: number | null
  rank_ws: number | null
  rank_revit: number | null
  balance_mismatch: boolean
}

export type CorrectionCalendarStatus = 'green' | 'red' | 'absent' | 'revit' | 'neutral'

export interface CorrectionCalendarDay {
  date: string
  status: CorrectionCalendarStatus
  label: string
  coins: number
  absence_type: string | null
  revit_launches: number
  has_shield: boolean
}

export interface CorrectionTransaction {
  transaction_id: string
  event_date: string
  event_type: string
  source: string
  coins: number
  description: string | null
  details: Record<string, unknown> | null
  created_at: string
}

export interface AdminCorrectionRow {
  id: string
  correction_type: CorrectionType
  status: CorrectionStatus
  admin_user_id: string | null
  target_user_id: string
  reason: string
  input_payload: Record<string, unknown>
  preview_snapshot: Record<string, unknown>
  planned_steps: CorrectionStep[]
  executed_steps: CorrectionStep[]
  created_event_ids: string[]
  created_transaction_ids: string[]
  error_message: string | null
  created_at: string
  started_at: string | null
  finished_at: string | null
  updated_at: string
}

export interface AvailableEventType {
  key: string
  name: string
  coins: number
  source: 'ws' | 'revit' | 'contest' | 'admin'
}

export interface CorrectionUserAppealTx {
  id: string
  event_date: string
  coins: number
  description: string
}

export interface CorrectionUserAppeal {
  id: string
  created_at: string
  status: 'new' | 'approved' | 'rejected'
  description: string | null
  task_url: string | null
  dates: string[] | null
  transactions: CorrectionUserAppealTx[]
  total_coins: number | null
  image_urls: string[]
  review_comment: string | null
  reviewed_at: string | null
}

export interface CorrectionUserDetail {
  user: CorrectionUserRow
  balance: {
    current: number
    transaction_sum: number
    delta: number
  }
  ws_streak: {
    current: number | null
    longest: number | null
    start_date: string | null
    completed_cycles: number
    pending_reset_date: string | null
    pending_reset_expires_at: string | null
  }
  revit_streak: {
    current: number | null
    best: number | null
    start_date: string | null
    completed_cycles: number
    pending_reset_date: string | null
    pending_reset_expires_at: string | null
  }
  calendar: CorrectionCalendarDay[]
  transactions: CorrectionTransaction[]
  leaderboard: {
    rank_ws: number | null
    rank_revit: number | null
    total_in_ws: number
    total_in_revit: number
  }
  corrections: AdminCorrectionRow[]
  appeals: CorrectionUserAppeal[]
  availableEventTypes: AvailableEventType[]
}
