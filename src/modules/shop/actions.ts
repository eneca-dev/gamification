'use server'

import { revalidatePath, revalidateTag } from 'next/cache'

import { createSupabaseAdminClient } from '@/config/supabase'
import { getCurrentUser } from '@/modules/auth'
import { checkIsAdmin } from '@/modules/admin/checkIsAdmin'

import { z } from 'zod'

import type { ActionResult } from '@/modules/cache'

import {
  createProductSchema,
  updateProductSchema,
  createCategorySchema,
  updateCategorySchema,
  setCrystalRateSchema,
  purchaseProductSchema,
} from './types'
import type { ProductMediaItem, PurchaseResult } from './types'
import { coverImageUrl } from './media'
import { removeUnreferencedProductMedia } from './storageMedia'
import { balanceTag } from './queries'

const productIdSchema = z.string().uuid()

// --- Баланс (polling) ---

export async function getBalanceAction(): Promise<ActionResult<number>> {
  const user = await getCurrentUser()
  if (!user?.wsUserId) return { success: false, error: 'Пользователь не найден' }

  const supabase = createSupabaseAdminClient()
  const { data } = await supabase
    .from('gamification_balances')
    .select('total_coins')
    .eq('user_id', user.wsUserId)
    .single()

  return { success: true, data: data?.total_coins ?? 0 }
}

// --- Покупка (доступна всем авторизованным) ---

export async function purchaseProduct(
  input: unknown
): Promise<{ success: true; data: PurchaseResult } | { success: false; error: string }> {
  const parsed = purchaseProductSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Невалидный запрос' }

  const user = await getCurrentUser()
  if (!user?.wsUserId) return { success: false, error: 'Пользователь не найден в системе' }

  const supabase = createSupabaseAdminClient()

  // Щиты продаются отдельной атомарной операцией с учётом предоплаченного остатка.
  const { data: product } = await supabase.from('shop_products').select('effect').eq('id', parsed.data.product_id).single()
  if (product?.effect === 'streak_shield_ws' || product?.effect === 'streak_shield_revit') {
    return { success: false, error: 'Купите защиту через карточку «Вторая жизнь»' }
  }

  const { data, error } = await supabase.rpc('purchase_product', {
    p_product_id: parsed.data.product_id,
    p_user_id: user.wsUserId,
    p_user_comment: parsed.data.user_comment ?? null,
  })

  if (error) {
    const msg = error.message
    if (msg.includes('comment_required')) return { success: false, error: 'Необходимо указать комментарий' }
    if (msg.includes('Недостаточно')) return { success: false, error: 'Недостаточно 💎' }
    if (msg.includes('Нет в наличии')) return { success: false, error: 'Нет в наличии' }
    if (msg.includes('недоступен')) return { success: false, error: 'Товар недоступен' }
    return { success: false, error: 'Ошибка при покупке' }
  }

  revalidateTag(balanceTag(user.wsUserId), 'max')
  revalidatePath('/store')
  revalidatePath('/profile')
  return { success: true, data: data as PurchaseResult }
}

// --- Курс кристаллов (только админ) ---

export async function setCrystalRate(
  input: unknown,
): Promise<{ success: true; rate: number } | { success: false; error: string }> {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) return { success: false, error: 'Доступ запрещён' }

  const parsed = setCrystalRateSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Невалидный курс' }

  const user = await getCurrentUser()
  const supabase = createSupabaseAdminClient()

  const { error } = await supabase
    .from('crystal_rates')
    .insert({ rate: parsed.data.rate, created_by: user?.wsUserId ?? null })

  if (error) return { success: false, error: error.message }

  // Обновляем ticket_price активных лотерей по новому курсу
  const newRate = parsed.data.rate
  const { data: activeLotteries } = await supabase
    .from('lottery_draws')
    .select('id, product_id')
    .eq('status', 'active')

  if (activeLotteries && activeLotteries.length > 0) {
    const productIds = activeLotteries.map((l) => l.product_id)
    const { data: products } = await supabase
      .from('shop_products')
      .select('id, cost_byn, coefficient')
      .in('id', productIds)

    if (products) {
      for (const lottery of activeLotteries) {
        const product = products.find((p) => p.id === lottery.product_id)
        if (product) {
          const newPrice = Math.round(Number(product.cost_byn) * Number(product.coefficient) * newRate)
          await supabase
            .from('lottery_draws')
            .update({ ticket_price: newPrice })
            .eq('id', lottery.id)
        }
      }
    }
  }

  // crystal-rate теперь меняет цены всех товаров — обновляем оба тега кэша
  revalidateTag('crystal-rate', 'max')
  revalidateTag('shop-products', 'max')
  revalidatePath('/admin/products')
  revalidatePath('/admin/economy')
  revalidatePath('/store')
  return { success: true, rate: parsed.data.rate }
}

// --- CRUD категорий (только админ) ---

export async function createCategory(
  input: unknown
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) return { success: false, error: 'Доступ запрещён' }

  const parsed = createCategorySchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Невалидные данные' }

  const supabase = createSupabaseAdminClient()

  const { data, error } = await supabase
    .from('shop_categories')
    .insert(parsed.data)
    .select('id')
    .single()

  if (error) {
    if (error.message.includes('duplicate')) return { success: false, error: 'Категория с таким именем или slug уже существует' }
    return { success: false, error: error.message }
  }

  revalidateTag('shop-categories', 'max')
  revalidateTag('shop-products', 'max')
  revalidatePath('/admin/products')
  revalidatePath('/store')
  return { success: true, id: data.id }
}

export async function updateCategory(
  input: unknown
): Promise<{ success: true; affectedProducts: { id: string; updated_at: string }[]; warning?: string } | { success: false; error: string }> {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) return { success: false, error: 'Доступ запрещён' }

  const parsed = updateCategorySchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Невалидные данные' }

  const { id, ...fields } = parsed.data
  const supabase = createSupabaseAdminClient()

  const { data, error } = await supabase
    .from('shop_categories')
    .update(fields)
    .eq('id', id)
    .select('id')

  if (error) return { success: false, error: error.message }
  if (!data || data.length === 0) return { success: false, error: 'Категория не найдена' }

  // При отключении исчисляемости — сбросить stock у всех товаров категории
  let affectedProducts: { id: string; updated_at: string }[] = []
  if (fields.is_countable === false) {
    const { data: affected, error: stockError } = await supabase
      .from('shop_products')
      .update({ stock: null, updated_at: new Date().toISOString() })
      .eq('category_id', id)
      .select('id, updated_at')
    if (stockError) {
      revalidateTag('shop-categories', 'max')
      revalidateTag('shop-products', 'max')
      revalidatePath('/admin/products')
      revalidatePath('/store')
      return { success: true, affectedProducts: [], warning: 'Категория обновлена, но не удалось сбросить остатки товаров' }
    }
    affectedProducts = affected ?? []
  }

  revalidateTag('shop-categories', 'max')
  revalidateTag('shop-products', 'max')
  revalidatePath('/admin/products')
  revalidatePath('/store')
  return { success: true, affectedProducts }
}

// --- CRUD товаров (только админ) ---

export async function createProduct(
  input: unknown
): Promise<{ success: true; id: string; updated_at: string } | { success: false; error: string }> {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) return { success: false, error: 'Доступ запрещён' }

  const user = await getCurrentUser()
  if (!user?.wsUserId) return { success: false, error: 'Пользователь не найден' }

  const parsed = createProductSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Невалидные данные' }

  const supabase = createSupabaseAdminClient()

  // image_url синхронизируется из первой картинки media — обложка для OrdersClient/AdminOrdersClient
  const insertData: Record<string, unknown> = {
    ...parsed.data,
    image_url: coverImageUrl(parsed.data.media),
    created_by: user.wsUserId,
  }
  if (parsed.data.stock === 0) {
    insertData.is_active = false
  }

  const { data, error } = await supabase
    .from('shop_products')
    .insert(insertData)
    .select('id, updated_at')
    .single()

  if (error) return { success: false, error: error.message }

  revalidateTag('shop-products', 'max')
  revalidatePath('/admin/products')
  revalidatePath('/store')
  return { success: true, id: data.id, updated_at: data.updated_at }
}

export async function updateProduct(
  input: unknown
): Promise<{ success: true; updated_at: string; warning?: string } | { success: false; error: string }> {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) return { success: false, error: 'Доступ запрещён' }

  const parsed = updateProductSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Невалидные данные' }

  const { id, expected_updated_at, ...fields } = parsed.data
  if (fields.media !== undefined && !expected_updated_at) {
    return { success: false, error: 'Обновите страницу и повторите сохранение товара' }
  }
  const supabase = createSupabaseAdminClient()
  const fieldsOut: Record<string, unknown> = { ...fields }

  // Stock = 0 → товар автоматически становится неактивным
  if (fields.stock === 0) {
    fieldsOut.is_active = false
  }

  // image_url синхронизируется с media только когда media передано в этом запросе
  let removedImageUrls: string[] = []
  let removedVideoUrls: string[] = []
  let removedPosterUrls: string[] = []
  if (fields.media !== undefined) {
    const nextMedia = fields.media as ProductMediaItem[]
    fieldsOut.image_url = coverImageUrl(nextMedia)
    const { data: current } = await supabase
      .from('shop_products')
      .select('media, updated_at')
      .eq('id', id)
      .single()
    if (!current) return { success: false, error: 'Товар не найден' }
    if (current.updated_at !== expected_updated_at) {
      return { success: false, error: 'Товар был изменён другим администратором. Обновите страницу' }
    }
    const prevMedia = Array.isArray(current?.media) ? (current.media as ProductMediaItem[]) : []
    const nextImageUrls = new Set(
      nextMedia.flatMap((m) => (m.kind === 'image' ? [m.url] : [])),
    )
    const nextVideoUrls = new Set(
      nextMedia.flatMap((m) => (m.kind === 'video' ? [m.url] : [])),
    )
    const nextPosterUrls = new Set(
      nextMedia.flatMap((m) => (m.kind === 'video' && m.poster_url ? [m.poster_url] : [])),
    )
    removedImageUrls = prevMedia.flatMap((m) =>
      m.kind === 'image' && !nextImageUrls.has(m.url) ? [m.url] : [],
    )
    removedVideoUrls = prevMedia.flatMap((m) =>
      m.kind === 'video' && !nextVideoUrls.has(m.url) ? [m.url] : [],
    )
    removedPosterUrls = prevMedia.flatMap((m) =>
      m.kind === 'video' && m.poster_url && !nextPosterUrls.has(m.poster_url) ? [m.poster_url] : [],
    )
  }

  // Запрет активации товара с нулевым остатком (для исчисляемых категорий)
  if (fields.is_active === true) {
    const { data: current } = await supabase
      .from('shop_products')
      .select('stock, category:shop_categories!category_id(is_countable)')
      .eq('id', id)
      .single()

    const category = Array.isArray(current?.category) ? current?.category[0] : current?.category
    const effectiveStock = fields.stock !== undefined ? fields.stock : current?.stock
    if (category?.is_countable && (effectiveStock ?? 0) === 0) {
      return { success: false, error: 'Нельзя активировать товар с нулевым остатком. Сначала укажите количество.' }
    }
  }

  let updateQuery = supabase
    .from('shop_products')
    .update({ ...fieldsOut, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (expected_updated_at) updateQuery = updateQuery.eq('updated_at', expected_updated_at)
  const { data, error } = await updateQuery.select('id, updated_at')

  if (error) return { success: false, error: error.message }
  if (!data || data.length === 0) return { success: false, error: 'Товар был изменён другим администратором. Обновите страницу' }

  const warning = await removeUnreferencedProductMedia([...removedImageUrls, ...removedPosterUrls, ...removedVideoUrls])

  revalidateTag('shop-products', 'max')
  revalidatePath('/admin/products')
  revalidatePath('/store')
  return { success: true, updated_at: data[0].updated_at, ...(warning ? { warning } : {}) }
}

const bulkProductSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(1000),
  change: z.discriminatedUnion('type', [
    z.object({ type: z.literal('price'), crystals: z.number().int().min(-1_000_000).max(1_000_000).refine((value) => value !== 0) }),
    z.object({ type: z.literal('discount'), percent: z.number().int().min(1).max(99).nullable() }),
    z.object({ type: z.literal('status'), status: z.enum(['active', 'inactive', 'coming_soon']) }),
  ]),
})

interface BulkProductUpdate {
  id: string
  updated_at: string
  price_adjustment_crystals?: number
  discount_percent?: number | null
  is_active?: boolean
  is_coming_soon?: boolean
}

export async function bulkUpdateProducts(input: unknown): Promise<
  { success: true; updated: BulkProductUpdate[]; errors: string[] } | { success: false; error: string }
> {
  if (!await checkIsAdmin()) return { success: false, error: 'Доступ запрещён' }
  const parsed = bulkProductSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Невалидные данные массового изменения' }

  const ids = [...new Set(parsed.data.ids)]
  const supabase = createSupabaseAdminClient()
  const rows = []
  for (let offset = 0; offset < ids.length; offset += 200) {
    const { data, error } = await supabase
      .from('shop_products')
      .select('id, name, cost_byn, coefficient, price_adjustment_crystals, stock, category:shop_categories!category_id(is_countable, is_active)')
      .in('id', ids.slice(offset, offset + 200))
    if (error) return { success: false, error: error.message }
    rows.push(...(data ?? []))
  }

  const byId = new Map(rows.map((row) => [row.id, row]))
  let rate = 0
  if (parsed.data.change.type === 'price') {
    const { data, error } = await supabase.rpc('current_crystal_rate')
    rate = Number(data)
    if (error || !Number.isFinite(rate) || rate <= 0) return { success: false, error: 'Не удалось получить текущий курс кристаллов' }
  }
  const updated: BulkProductUpdate[] = []
  const errors: string[] = []
  for (const id of ids) {
    const row = byId.get(id)
    if (!row) { errors.push(`Товар ${id} не найден`); continue }

    const fields: Omit<BulkProductUpdate, 'id' | 'updated_at'> = {}
    const change = parsed.data.change
    if (change.type === 'price') {
      const base = Math.round(Number(row.cost_byn) * Number(row.coefficient) * rate)
      const currentPrice = Math.max(1, base + Number(row.price_adjustment_crystals))
      const targetPrice = currentPrice + change.crystals
      const adjustment = targetPrice - base
      if (targetPrice < 1 || targetPrice > 2_147_483_647 || !Number.isSafeInteger(adjustment) || Math.abs(adjustment) > 1_000_000_000) {
        errors.push(`${row.name}: итоговая цена должна быть положительной и помещаться в допустимый диапазон`)
        continue
      }
      fields.price_adjustment_crystals = adjustment
    } else if (change.type === 'discount') {
      fields.discount_percent = change.percent
    } else {
      const category = Array.isArray(row.category) ? row.category[0] : row.category
      if (change.status === 'active' && (!category?.is_active || (category.is_countable && (row.stock ?? 0) === 0))) {
        errors.push(`${row.name}: нельзя активировать товар в неактивной категории или с нулевым остатком`)
        continue
      }
      fields.is_active = change.status === 'active'
      fields.is_coming_soon = change.status === 'coming_soon'
    }

    let updateQuery = supabase.from('shop_products')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (change.type === 'price') updateQuery = updateQuery.eq('price_adjustment_crystals', row.price_adjustment_crystals)
    const { data: saved, error } = await updateQuery
      .select('id, updated_at')
      .maybeSingle()
    if (error) { errors.push(`${row.name}: ${error.message}`); continue }
    if (!saved) { errors.push(`${row.name}: товар изменился или больше не найден, повторите действие`); continue }
    updated.push({ id, updated_at: saved.updated_at, ...fields })
  }

  if (updated.length > 0) {
    revalidateTag('shop-products', 'max')
    revalidatePath('/admin/products')
    revalidatePath('/store')
  }
  return { success: true, updated, errors }
}

// --- Удаление товара (только админ) ---

export async function deleteProduct(
  productId: unknown
): Promise<{ success: true; warning?: string } | { success: false; error: string }> {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) return { success: false, error: 'Доступ запрещён' }

  const parsed = productIdSchema.safeParse(productId)
  if (!parsed.success) return { success: false, error: 'Невалидный ID товара' }

  const supabase = createSupabaseAdminClient()

  // Проверяем, нет ли заказов на этот товар
  const { count } = await supabase
    .from('shop_orders')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', parsed.data)

  if (count && count > 0) {
    return { success: false, error: 'Нельзя удалить товар с существующими заказами. Деактивируйте его вместо удаления' }
  }

  // Собираем все пути к медиа до удаления строки
  const { data: current, error: readError } = await supabase
    .from('shop_products')
    .select('media, updated_at')
    .eq('id', parsed.data)
    .maybeSingle()
  if (readError) return { success: false, error: readError.message }
  if (!current) return { success: false, error: 'Товар не найден' }
  const mediaItems = Array.isArray(current?.media) ? (current.media as ProductMediaItem[]) : []
  const mediaUrls = mediaItems
    .flatMap((m) => {
      if (m.kind === 'image') return [m.url]
      if (m.kind === 'video') return [m.url, ...(m.poster_url ? [m.poster_url] : [])]
      return []
    })

  const { data: deleted, error } = await supabase
    .from('shop_products')
    .delete()
    .eq('id', parsed.data)
    .eq('updated_at', current.updated_at)
    .select('id')

  if (error) return { success: false, error: error.message }
  if (!deleted?.length) return { success: false, error: 'Товар был изменён другим администратором. Обновите страницу' }

  const warning = await removeUnreferencedProductMedia(mediaUrls)

  revalidateTag('shop-products', 'max')
  revalidatePath('/admin/products')
  revalidatePath('/store')
  return { success: true, ...(warning ? { warning } : {}) }
}

export async function cleanupFailedProductUploads(
  urls: unknown,
): Promise<{ success: true } | { success: false; error: string }> {
  if (!await checkIsAdmin()) return { success: false, error: 'Доступ запрещён' }
  const parsed = z.array(z.string().url()).max(8).safeParse(urls)
  if (!parsed.success) return { success: false, error: 'Невалидные адреса файлов' }
  const error = await removeUnreferencedProductMedia(parsed.data)
  return error ? { success: false, error } : { success: true }
}

// --- Загрузка изображений (только админ) ---

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'] as const
const MAX_IMAGE_SIZE = 2 * 1024 * 1024

export async function uploadProductImage(
  formData: FormData
): Promise<{ success: true; url: string } | { success: false; error: string }> {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) return { success: false, error: 'Доступ запрещён' }

  const file = formData.get('file') as File | null
  if (!file) return { success: false, error: 'Файл не выбран' }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type as typeof ALLOWED_IMAGE_TYPES[number])) {
    return { success: false, error: 'Формат: JPEG, PNG или WebP' }
  }
  if (file.size > MAX_IMAGE_SIZE) return { success: false, error: 'Максимум 2 МБ' }

  const rawExt = (file.name.split('.').pop() ?? '').toLowerCase()
  const ext = ALLOWED_EXTENSIONS.includes(rawExt as typeof ALLOWED_EXTENSIONS[number]) ? rawExt : 'jpg'

  const supabase = createSupabaseAdminClient()
  const path = `products/${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${ext}`

  const { error } = await supabase.storage
    .from('product-images')
    .upload(path, file)

  if (error) return { success: false, error: 'Ошибка загрузки изображения' }

  const { data: { publicUrl } } = supabase.storage
    .from('product-images')
    .getPublicUrl(path)

  return { success: true, url: publicUrl }
}
