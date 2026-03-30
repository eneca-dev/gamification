import { z } from 'zod'

// --- Старый тип для at_gratitudes (оставлен для совместимости) ---
export interface GratitudeFeedItem {
  id: string
  sender_email: string
  sender_name: string
  recipient_email: string
  recipient_name: string
  message: string
  airtable_created_at: string
  week_start: string
  earned_coins: number
}

// --- Категории благодарностей ---
export const GRATITUDE_CATEGORIES = [
  { slug: 'help', label: 'Помощь и поддержка', emoji: '🤝' },
  { slug: 'quality', label: 'Профессионализм', emoji: '⭐' },
  { slug: 'mentoring', label: 'Наставничество', emoji: '📚' },
  { slug: 'teamwork', label: 'Командная работа', emoji: '🛡️' },
  { slug: 'atmosphere', label: 'Позитив и атмосфера', emoji: '☀️' },
  { slug: 'other', label: 'Другое', emoji: '💬' },
] as const

export type GratitudeCategory = (typeof GRATITUDE_CATEGORIES)[number]['slug']

// --- Типы отправки ---
export type GratitudeType = 'thanks' | 'gift'
export type GiftSource = 'quota' | 'balance'

// --- Квота отправителя ---
export interface SenderQuota {
  used: boolean
  coins_per_gratitude: number
  period_start: string
  period_end: string
  next_quota_date: string | null
}

// --- Получатель для выбора ---
export interface GratitudeRecipient {
  id: string
  name: string
  department: string | null
}

// --- Новая благодарность в ленте ---
export interface GratitudeNew {
  id: string
  type: GratitudeType
  gift_source: GiftSource | null
  category: string | null
  coins_amount: number
  sender_email: string
  sender_name: string
  sender_department: string | null
  recipient_email: string
  recipient_name: string
  recipient_department: string | null
  message: string
  created_at: string
  earned_coins: number
}

// --- Zod-схемы с валидацией комбинаций ---
const categoryEnum = z.enum(['help', 'quality', 'mentoring', 'teamwork', 'atmosphere', 'other'])

export const sendGratitudeSchema = z.object({
  recipient_id: z.string().uuid(),
  message: z.string().min(1, 'Напишите сообщение').max(500, 'Максимум 500 символов'),
  category: categoryEnum,
  type: z.enum(['thanks', 'gift']),
  gift_source: z.enum(['quota', 'balance']).nullable(),
  coins_amount: z.number().int().min(0).max(1000).default(0),
}).refine(
  (data) => {
    if (data.type === 'thanks') return data.gift_source === null && data.coins_amount === 0
    if (data.type === 'gift' && data.gift_source === 'quota') return data.coins_amount === 0
    if (data.type === 'gift' && data.gift_source === 'balance') return data.coins_amount > 0
    return data.gift_source !== null
  },
  { message: 'Некорректная комбинация типа и суммы' }
)

export type SendGratitudeInput = z.infer<typeof sendGratitudeSchema>
