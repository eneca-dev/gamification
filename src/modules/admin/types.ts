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
