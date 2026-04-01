import { z } from 'zod'

// --- Статусы заказов ---

export const ORDER_STATUSES = ['pending', 'processing', 'fulfilled', 'cancelled'] as const
export const orderStatusSchema = z.enum(ORDER_STATUSES)
export type OrderStatus = z.infer<typeof orderStatusSchema>

// --- Категории ---

export interface ShopCategory {
  id: string
  name: string
  slug: string
  description: string | null
  is_physical: boolean
  sort_order: number
  is_active: boolean
  created_at: string
}

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Название обязательно').max(100),
  slug: z.string().min(1, 'Slug обязателен').max(50).regex(/^[a-z0-9-]+$/, 'Только латиница, цифры и дефис'),
  description: z.string().max(500).nullable().optional(),
  is_physical: z.boolean(),
  sort_order: z.number().int().min(0).default(0),
})

export const updateCategorySchema = createCategorySchema.partial().extend({
  id: z.string().uuid(),
  is_active: z.boolean().optional(),
})

export type CreateCategoryInput = z.infer<typeof createCategorySchema>
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>

// --- Товары ---

export interface ShopProduct {
  id: string
  name: string
  description: string | null
  price: number
  category_id: string
  image_url: string | null
  emoji: string | null
  effect: string | null
  is_active: boolean
  stock: number | null
  sort_order: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ShopProductWithCategory extends ShopProduct {
  category: Pick<ShopCategory, 'name' | 'slug' | 'is_physical' | 'is_active'>
}

export const createProductSchema = z.object({
  name: z.string().min(1, 'Название обязательно').max(200),
  description: z.string().max(1000).nullable().optional(),
  price: z.number().int().positive('Цена должна быть больше 0'),
  category_id: z.string().uuid(),
  image_url: z.string().url().nullable().optional(),
  emoji: z.string().max(10).nullable().optional(),
  stock: z.number().int().min(0).nullable().optional(),
  sort_order: z.number().int().min(0).default(0),
})

export const updateProductSchema = createProductSchema.partial().extend({
  id: z.string().uuid(),
  is_active: z.boolean().optional(),
})

export type CreateProductInput = z.infer<typeof createProductSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>

// --- Заказы ---

export interface ShopOrder {
  id: string
  user_id: string
  product_id: string
  status: OrderStatus
  status_changed_by: string | null
  status_changed_at: string | null
  transaction_id: string
  refund_transaction_id: string | null
  note: string | null
  created_at: string
}

export interface ShopOrderWithDetails extends ShopOrder {
  product: Pick<ShopProduct, 'name' | 'emoji' | 'image_url'>
  coins_spent: number
}

// --- Результаты RPC ---

export interface PurchaseResult {
  order_id: string
  status: OrderStatus
  coins_spent: number
}

export interface CancelResult {
  refund_amount: number
  refund_transaction_id: string
}
