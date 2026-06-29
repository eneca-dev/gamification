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
  bulkUpdateProductsSchema,
  computeBulkPatch,
} from './types'
import type { PurchaseResult, BulkUpdateResult, BulkPatch, BulkPatchProductInfo } from './types'
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

  revalidatePath('/admin/products')
  revalidatePath('/store')
  return { success: true, id: data.id }
}

export async function updateCategory(
  input: unknown
): Promise<{ success: true } | { success: false; error: string }> {
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
  if (fields.is_countable === false) {
    await supabase
      .from('shop_products')
      .update({ stock: null, updated_at: new Date().toISOString() })
      .eq('category_id', id)
  }

  revalidatePath('/admin/products')
  revalidatePath('/store')
  return { success: true }
}

// --- CRUD товаров (только админ) ---

export async function createProduct(
  input: unknown
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) return { success: false, error: 'Доступ запрещён' }

  const user = await getCurrentUser()
  if (!user?.wsUserId) return { success: false, error: 'Пользователь не найден' }

  const parsed = createProductSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Невалидные данные' }

  const supabase = createSupabaseAdminClient()

  // Stock = 0 → товар сразу создаётся неактивным
  const insertData: Record<string, unknown> = { ...parsed.data, created_by: user.wsUserId }
  if (parsed.data.stock === 0) {
    insertData.is_active = false
  }

  const { data, error } = await supabase
    .from('shop_products')
    .insert(insertData)
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath('/admin/products')
  revalidatePath('/store')
  return { success: true, id: data.id }
}

export async function updateProduct(
  input: unknown
): Promise<{ success: true } | { success: false; error: string }> {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) return { success: false, error: 'Доступ запрещён' }

  const parsed = updateProductSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Невалидные данные' }

  const { id, ...fields } = parsed.data
  const supabase = createSupabaseAdminClient()

  // Stock = 0 → товар автоматически становится неактивным
  if (fields.stock === 0) {
    fields.is_active = false
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

  const { data, error } = await supabase
    .from('shop_products')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id')

  if (error) return { success: false, error: error.message }
  if (!data || data.length === 0) return { success: false, error: 'Товар не найден' }

  revalidateTag('shop-products', 'max')
  revalidatePath('/admin/products')
  revalidatePath('/store')
  return { success: true }
}

export async function updateProductsBulk(
  input: unknown,
): Promise<{ success: true; data: BulkUpdateResult } | { success: false; error: string }> {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) return { success: false, error: 'Доступ запрещён' }

  const parsed = bulkUpdateProductsSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Невалидные данные' }

  const { ids, ...op } = parsed.data
  const supabase = createSupabaseAdminClient()

  const { data: rows, error: fetchError } = await supabase
    .from('shop_products')
    .select('id, cost_byn, coefficient, discount_percent, stock, is_active, is_coming_soon, category:shop_categories!category_id(is_countable)')
    .in('id', ids)

  if (fetchError) return { success: false, error: fetchError.message }
  if (!rows || rows.length === 0) return { success: false, error: 'Товары не найдены' }

  const skipped: BulkUpdateResult['skipped'] = []
  const patches: { id: string; patch: BulkPatch }[] = []

  for (const row of rows) {
    const category = Array.isArray(row.category) ? row.category[0] : row.category
    const info: BulkPatchProductInfo = {
      cost_byn: Number(row.cost_byn),
      coefficient: Number(row.coefficient),
      discount_percent: row.discount_percent,
      stock: row.stock,
      is_active: row.is_active,
      is_coming_soon: row.is_coming_soon,
      is_countable: !!category?.is_countable,
    }
    const result = computeBulkPatch(info, op)
    if (result.ok) patches.push({ id: row.id, patch: result.patch })
    else skipped.push({ id: row.id, reason: result.reason })
  }

  if (patches.length === 0) return { success: true, data: { updated: 0, skipped } }

  const updatedAt = new Date().toISOString()

  // Одинаковые патчи (op=set / status) → один запрос; разные (add/subtract) → по одному
  const firstPatch = JSON.stringify(patches[0].patch)
  const allSame = patches.every((p) => JSON.stringify(p.patch) === firstPatch)

  if (allSame) {
    const { error } = await supabase
      .from('shop_products')
      .update({ ...patches[0].patch, updated_at: updatedAt })
      .in('id', patches.map((p) => p.id))
    if (error) return { success: false, error: error.message }
  } else {
    for (const { id, patch } of patches) {
      const { error } = await supabase
        .from('shop_products')
        .update({ ...patch, updated_at: updatedAt })
        .eq('id', id)
      if (error) return { success: false, error: error.message }
    }
  }

  revalidateTag('shop-products', 'max')
  revalidatePath('/admin/products')
  revalidatePath('/store')
  return { success: true, data: { updated: patches.length, skipped } }
}

export async function deleteProductsBulk(
  ids: unknown,
): Promise<{ success: true; data: BulkUpdateResult } | { success: false; error: string }> {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) return { success: false, error: 'Доступ запрещён' }

  const parsed = z.array(z.string().uuid()).min(1).max(500).safeParse(ids)
  if (!parsed.success) return { success: false, error: 'Невалидный список товаров' }

  const supabase = createSupabaseAdminClient()

  // Товары с существующими заказами удалять нельзя — пропускаем
  const { data: orderRows } = await supabase
    .from('shop_orders')
    .select('product_id')
    .in('product_id', parsed.data)

  const withOrders = new Set((orderRows ?? []).map((o) => o.product_id))
  const deletable = parsed.data.filter((id) => !withOrders.has(id))
  const skipped = parsed.data
    .filter((id) => withOrders.has(id))
    .map((id) => ({ id, reason: 'есть заказы' }))

  if (deletable.length === 0) return { success: true, data: { updated: 0, skipped } }

  // Подчищаем изображения из Storage
  const { data: products } = await supabase
    .from('shop_products')
    .select('image_url')
    .in('id', deletable)

  const paths = (products ?? [])
    .map((p) => p.image_url?.split('/product-images/')[1])
    .filter((path): path is string => !!path && path.startsWith('products/'))

  if (paths.length > 0) {
    await supabase.storage.from('product-images').remove(paths)
  }

  const { error } = await supabase.from('shop_products').delete().in('id', deletable)
  if (error) return { success: false, error: error.message }

  revalidateTag('shop-products', 'max')
  revalidatePath('/admin/products')
  revalidatePath('/store')
  return { success: true, data: { updated: deletable.length, skipped } }
}

// --- Удаление товара (только админ) ---

export async function deleteProduct(
  productId: unknown
): Promise<{ success: true } | { success: false; error: string }> {
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

  const { error } = await supabase
    .from('shop_products')
    .delete()
    .eq('id', parsed.data)

  if (error) return { success: false, error: error.message }

  revalidatePath('/admin/products')
  revalidatePath('/store')
  return { success: true }
}

// --- Загрузка изображений (только админ) ---

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'] as const
const MAX_IMAGE_SIZE = 2 * 1024 * 1024

const imageUrlSchema = z.string().url().refine(
  (url) => url.includes('/product-images/products/'),
  'Невалидный URL изображения'
)

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

export async function deleteProductImage(
  imageUrl: unknown
): Promise<{ success: true } | { success: false; error: string }> {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) return { success: false, error: 'Доступ запрещён' }

  const parsed = imageUrlSchema.safeParse(imageUrl)
  if (!parsed.success) return { success: false, error: 'Невалидный URL изображения' }

  const path = parsed.data.split('/product-images/')[1]
  if (!path || !path.startsWith('products/')) return { success: false, error: 'Невалидный путь' }

  const supabase = createSupabaseAdminClient()
  await supabase.storage.from('product-images').remove([path])

  return { success: true }
}
