import { z } from 'zod'

export const DAY_OFF_STATUSES = ['pending', 'approved', 'rejected'] as const
export const dayOffStatusSchema = z.enum(DAY_OFF_STATUSES)
export type DayOffStatus = z.infer<typeof dayOffStatusSchema>

export const STATUS_LABELS: Record<DayOffStatus, string> = {
  pending:  'На рассмотрении',
  approved: 'Одобрено',
  rejected: 'Отклонено',
}

export const DAY_OFF_REQUEST_TYPES = ['day_off', 'business_trip'] as const
export type DayOffRequestType = typeof DAY_OFF_REQUEST_TYPES[number]

export const REQUEST_TYPE_LABELS: Record<DayOffRequestType, string> = {
  day_off:       'Соцотпуск',
  business_trip: 'Командировка',
}

export interface DayOffRequest {
  id: string
  ws_user_id: string
  user_name: string
  requested_date: string
  request_type: DayOffRequestType
  note: string | null
  screenshot_url: string | null
  status: DayOffStatus
  rejection_reason: string | null
  reviewed_at: string | null
  resolved_at: string | null
  created_at: string
}

// Расширенный тип только для админских запросов (service_role)
export interface DayOffRequestAdmin extends DayOffRequest {
  approved_by_name: string | null
  rejected_by_name: string | null
}

export const submitDayOffSchema = z.object({
  requested_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Некорректный формат даты'),
  request_type: z.enum(DAY_OFF_REQUEST_TYPES).default('day_off'),
  note: z.string().max(500).optional(),
  screenshot_url: z.string().nullable().optional(),
})

export type SubmitDayOffInput = z.infer<typeof submitDayOffSchema>

export const rejectDayOffSchema = z.object({
  id: z.string().uuid(),
  rejection_reason: z.string().max(500).optional(),
})

export type RejectDayOffInput = z.infer<typeof rejectDayOffSchema>

const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Некорректный формат даты')

export const submitBatchDayOffSchema = z.object({
  requested_dates: z
    .array(dateStringSchema)
    .min(1, 'Выберите хотя бы одну дату')
    .max(31, 'Не более 31 даты за один раз'),
  request_type: z.enum(DAY_OFF_REQUEST_TYPES).default('day_off'),
  note: z.string().max(500).optional(),
  screenshot_url: z.string().nullable().optional(),
})

export type SubmitBatchDayOffInput = z.infer<typeof submitBatchDayOffSchema>
