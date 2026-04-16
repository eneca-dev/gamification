import { z } from 'zod'

// --- Статусы лотереи ---

export const LOTTERY_STATUSES = ['active', 'completed'] as const
export type LotteryStatus = (typeof LOTTERY_STATUSES)[number]

// --- Лотерея (строка из БД) ---

export interface LotteryDraw {
  id: string
  name: string
  description: string | null
  image_url: string | null
  ticket_price: number
  product_id: string
  status: LotteryStatus
  month: string
  winner_user_id: string | null
  drawn_at: string | null
  created_by: string
  created_at: string
}

// --- Лотерея со статистикой (для UI) ---

export interface LotteryWithStats extends LotteryDraw {
  total_tickets: number
  total_participants: number
  winner?: {
    first_name: string
    last_name: string
    department: string | null
  }
}

// --- Инфо о билетах пользователя ---

export interface UserTicketInfo {
  ticket_count: number
  total_tickets: number
  chance_percent: number
}

// --- Схема создания лотереи ---

export const createLotterySchema = z.object({
  name: z.string().min(1, 'Название приза обязательно').max(200),
  description: z.string().max(1000).nullable().optional(),
  image_url: z.string().url().nullable().optional(),
  ticket_price: z.number().int().positive('Цена билета должна быть больше 0').default(300),
})

export type CreateLotteryInput = z.infer<typeof createLotterySchema>

// --- Схема обновления лотереи ---

export const updateLotterySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Название приза обязательно').max(200),
  description: z.string().max(1000).nullable().optional(),
  image_url: z.string().url().nullable().optional(),
  ticket_price: z.number().int().positive('Цена билета должна быть больше 0'),
})

export type UpdateLotteryInput = z.infer<typeof updateLotterySchema>
