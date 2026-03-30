import { z } from 'zod'

// --- Event Types ---

export interface EventTypeRow {
  key: string
  name: string
  coins: number
  description: string | null
  is_active: boolean
}

export const updateEventTypeSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1).optional(),
  coins: z.number().int().optional(),
  description: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
})

export type UpdateEventTypeInput = z.infer<typeof updateEventTypeSchema>

// --- Users ---

export interface AdminUserRow {
  id: string
  email: string
  first_name: string
  last_name: string
  department: string | null
  team: string | null
  is_admin: boolean
  is_active: boolean
  total_coins: number
}

export interface UserTransaction {
  event_date: string
  event_type: string
  source: string
  coins: number
  description: string | null
  details: Record<string, unknown> | null
  created_at: string
}

export interface UserDetail {
  user: AdminUserRow
  transactions: UserTransaction[]
}

// --- Orders ---

export interface AdminOrderRow {
  id: string
  user_id: string
  user_name: string
  user_email: string
  product_id: string
  product_name: string
  product_emoji: string | null
  product_image_url: string | null
  is_physical: boolean
  status: 'pending' | 'processing' | 'fulfilled' | 'cancelled'
  coins_spent: number
  note: string | null
  status_changed_by: string | null
  status_changed_at: string | null
  created_at: string
}

export const updateOrderStatusSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum(['pending', 'processing', 'fulfilled']),
  note: z.string().max(500).nullable().optional(),
})

export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>

export const cancelOrderSchema = z.object({
  orderId: z.string().uuid(),
  note: z.string().max(500).nullable().optional(),
})

export type CancelOrderInput = z.infer<typeof cancelOrderSchema>

// --- Форматирование причин красного дня для транзакций ---

const WS_BASE = 'https://eneca.worksection.com/project'

function buildWsTaskUrl(details: Record<string, unknown>): string | null {
  const projectId = details.ws_project_id as string | undefined
  const taskId = details.ws_task_id as string | undefined
  const l2Id = details.ws_l2_id as string | undefined
  if (!projectId || !taskId) return null
  if (l2Id) return `${WS_BASE}/${projectId}/${l2Id}/${taskId}/`
  return `${WS_BASE}/${projectId}/${taskId}/`
}

/** Человеко-читаемое описание причины для транзакции */
export function formatTransactionReason(tx: UserTransaction): string | null {
  if (!tx.details) return null
  const d = tx.details

  if (tx.event_type === 'red_day') {
    return 'Не внесён отчёт'
  }

  if (tx.event_type === 'task_dynamics_violation') {
    const name = (d.ws_task_name as string) ?? 'неизвестная задача'
    const url = buildWsTaskUrl(d)
    return url
      ? `В задаче «${name}» не был вовремя сменён процент готовности — ${url}`
      : `В задаче «${name}» не был вовремя сменён процент готовности`
  }

  if (tx.event_type === 'section_red') {
    const name = (d.violator_task_name as string) ?? (d.ws_task_name as string) ?? 'неизвестная задача'
    const violatorProjectId = d.violator_project_id as string | undefined
    const violatorTaskId = d.violator_task_id as string | undefined
    const l2Id = d.ws_task_id as string | undefined
    let url: string | null = null
    if (violatorProjectId && violatorTaskId) {
      url = l2Id
        ? `${WS_BASE}/${violatorProjectId}/${l2Id}/${violatorTaskId}/`
        : `${WS_BASE}/${violatorProjectId}/${violatorTaskId}/`
    }
    return url
      ? `В задаче «${name}» не была вовремя сменена метка готовности — ${url}`
      : `В задаче «${name}» не была вовремя сменена метка готовности`
  }

  return null
}

// --- Calendar (holidays / workdays) ---

export interface CalendarHolidayRow {
  id: number
  date: string
  name: string
  created_at: string
}

export interface CalendarWorkdayRow {
  id: number
  date: string
  name: string
  created_at: string
}

export const addCalendarDateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Формат даты: YYYY-MM-DD'),
  name: z.string().min(1, 'Название обязательно').max(100, 'Максимум 100 символов'),
})

export type AddCalendarDateInput = z.infer<typeof addCalendarDateSchema>

export const deleteCalendarDateSchema = z.object({
  id: z.number().int().positive(),
})

export type DeleteCalendarDateInput = z.infer<typeof deleteCalendarDateSchema>

// --- Achievement Ranking Settings ---

export interface RankingSettingRow {
  area: string
  entity_type: string
  threshold: number
  is_active: boolean
}

export const updateRankingSettingSchema = z.object({
  area: z.string().min(1),
  entity_type: z.string().min(1),
  threshold: z.number().int().min(1).max(31).optional(),
  is_active: z.boolean().optional(),
})

export type UpdateRankingSettingInput = z.infer<typeof updateRankingSettingSchema>

// --- Achievement Gratitude Settings ---

export interface GratitudeSettingRow {
  category: string
  achievement_name: string
  threshold: number
  bonus_coins: number
  is_active: boolean
}

export const updateGratitudeSettingSchema = z.object({
  category: z.string().min(1),
  achievement_name: z.string().min(1).optional(),
  threshold: z.number().int().min(1).optional(),
  bonus_coins: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
})

export type UpdateGratitudeSettingInput = z.infer<typeof updateGratitudeSettingSchema>

// --- Форма товара (используется в ProductFormModal → ProductsClient) ---

export interface ProductFormData {
  name: string
  description: string | null
  price: number
  category_id: string
  image_url: string | null
  emoji: string | null
  stock: number | null
  sort_order: number
}
