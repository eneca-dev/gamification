import { z } from 'zod'

export type FeedbackType = 'bug' | 'suggestion' | 'appeal'

export type AppealStatus = 'new' | 'approved' | 'rejected'

export interface AppealCalendarDay {
  date: string
  status: 'green' | 'red' | 'absent' | 'none'
  absence_type: string | null
  negative_coins: number
}

// Транзакция в списке выбора для обжалования — минимальный набор для отображения
export interface AppealTransaction {
  id: string
  event_date: string
  event_type: string
  source: string
  coins: number
  description: string
  icon: string
}

export const appealStatusLabels: Record<AppealStatus, string> = {
  new: 'На рассмотрении',
  approved: 'Одобрено',
  rejected: 'Отклонено',
}

const dateRegex = /^\d{4}-\d{2}-\d{2}$/

const bugOrSuggestionSchema = z.object({
  type: z.enum(['bug', 'suggestion']),
  header: z.string().min(1, 'Заголовок обязателен').max(200),
  description: z.string().optional(),
  expected_behavior: z.string().optional(),
  image_urls: z.array(z.string().url()).default([]),
})

const appealSchema = z.object({
  type: z.literal('appeal'),
  dates: z.array(z.string().regex(dateRegex)).default([]),
  transaction_ids: z.array(z.string().uuid()).default([]),
  description: z.string().min(5, 'Опишите ситуацию подробнее (минимум 5 символов)').max(2000),
  task_url: z.string().url('Некорректная ссылка').optional().or(z.literal('')),
  image_urls: z.array(z.string().url()).default([]),
})
// Проверка «хотя бы один день или одна транзакция» делается в submitFeedback — refine
// нельзя внутри discriminatedUnion (zod требует чистый ZodObject для каждого варианта).

export const FeedbackSchema = z.discriminatedUnion('type', [
  bugOrSuggestionSchema,
  appealSchema,
])

export type FeedbackInput = z.infer<typeof FeedbackSchema>
export type AppealInput = z.infer<typeof appealSchema>

export interface FeedbackRecord {
  id: string
  created_at: string
  type: FeedbackType
  header: string
  description: string | null
  expected_behavior: string | null
  image_urls: string[]
  airtable_id: string | null
  user_id: string | null
  user_name: string | null
  user_email: string | null
  user_department: string | null
  user_team: string | null
  ws_user_id: string | null
  // Поля обжалования (nullable для bug/suggestion)
  appeal_dates: string[] | null
  appeal_transaction_ids: string[] | null
  appeal_task_url: string | null
  appeal_manager_name: string | null
  appeal_total_coins: number | null
  status: AppealStatus
  review_comment: string | null
  reviewed_at: string | null
  reviewed_by: string | null
}
