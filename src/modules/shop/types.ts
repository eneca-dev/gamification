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
  is_countable: boolean
  sort_order: number
  is_active: boolean
  created_at: string
}

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Название обязательно').max(100),
  slug: z.string().min(1, 'Slug обязателен').max(50).regex(/^[a-z0-9-]+$/, 'Только латиница, цифры и дефис'),
  description: z.string().max(500).nullable().optional(),
  is_physical: z.boolean(),
  is_countable: z.boolean(),
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
  cost_byn: number
  coefficient: number
  price: number
  category_id: string
  image_url: string | null
  emoji: string | null
  effect: string | null
  is_active: boolean
  is_coming_soon: boolean
  discount_percent: number | null
  stock: number | null
  sort_order: number
  comment_required: boolean
  comment_label: string | null
  comment_placeholder: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ShopProductWithCategory extends ShopProduct {
  category: Pick<ShopCategory, 'name' | 'slug' | 'is_physical' | 'is_countable' | 'is_active'>
}

export const createProductSchema = z.object({
  name: z.string().min(1, 'Название обязательно').max(200),
  description: z.string().max(1000).nullable().optional(),
  cost_byn: z.number().positive('Себестоимость должна быть больше 0'),
  coefficient: z.number().positive('Коэффициент должен быть больше 0').default(1),
  category_id: z.string().uuid(),
  image_url: z.string().url().nullable().optional(),
  emoji: z.string().max(10).nullable().optional(),
  effect: z.string().max(100).nullable().optional(),
  discount_percent: z.number().int().min(1).max(500).nullable().optional(),
  stock: z.number().int().min(0).nullable().optional(),
  sort_order: z.number().int().min(0).default(0),
  comment_required: z.boolean().default(false),
  comment_label: z.string().max(200).nullable().optional(),
  comment_placeholder: z.string().max(300).nullable().optional(),
})

export const updateProductSchema = createProductSchema.partial().extend({
  id: z.string().uuid(),
  is_active: z.boolean().optional(),
  is_coming_soon: z.boolean().optional(),
})

export type CreateProductInput = z.infer<typeof createProductSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>

// --- Курс кристаллов ---

export interface CrystalRate {
  id: number
  rate: number
  created_at: string
  created_by: string | null
}

export const setCrystalRateSchema = z.object({
  rate: z.number().positive('Курс должен быть больше 0'),
})

export type SetCrystalRateInput = z.infer<typeof setCrystalRateSchema>

export function computePriceCrystals(costByn: number, coefficient: number, rate: number): number {
  return Math.round(costByn * coefficient * rate)
}

/** Зачёркнутая цена в кристаллах = реальная цена × (1 + наценка / 100). */
export function computePriceWithoutDiscount(priceInCrystals: number, discountPercent: number): number {
  return Math.round(priceInCrystals * (1 + discountPercent / 100))
}

/** Процент скидки для бейджа (от цены без скидки). Считается от discountPercent напрямую — без дрейфа от округления. */
export function computeDisplayDiscount(discountPercent: number): number {
  return Math.round((discountPercent / (100 + discountPercent)) * 100)
}

/** Конвертирует кристаллы → BYN по текущему курсу. Округление до копеек. */
export function coinsToByn(coins: number, rate: number): number {
  if (rate <= 0) return 0
  return Math.round((coins / rate) * 100) / 100
}

/** Форматирует BYN-сумму для отображения: "1 250,50 BYN". */
export function formatByn(amount: number): string {
  return `${amount.toLocaleString('ru-BY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BYN`
}

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
  user_comment: string | null
  created_at: string
}

export const purchaseProductSchema = z.object({
  product_id: z.string().uuid('Невалидный ID товара'),
  user_comment: z.string().max(1000).nullable().optional(),
})

export type PurchaseProductInput = z.infer<typeof purchaseProductSchema>

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
