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
} from './types'
import type { PurchaseResult } from './types'

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
  productId: unknown
): Promise<{ success: true; data: PurchaseResult } | { success: false; error: string }> {
  const parsed = productIdSchema.safeParse(productId)
  if (!parsed.success) return { success: false, error: 'Невалидный ID товара' }

  const user = await getCurrentUser()
  if (!user?.wsUserId) return { success: false, error: 'Пользователь не найден в системе' }

  const supabase = createSupabaseAdminClient()

  const { data, error } = await supabase.rpc('purchase_product', {
    p_product_id: parsed.data,
    p_user_id: user.wsUserId,
  })

  if (error) {
    const msg = error.message
    if (msg.includes('Недостаточно')) return { success: false, error: 'Недостаточно 💎' }
    if (msg.includes('Нет в наличии')) return { success: false, error: 'Нет в наличии' }
    if (msg.includes('недоступен')) return { success: false, error: 'Товар недоступен' }
    return { success: false, error: 'Ошибка при покупке' }
  }

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

  revalidatePath('/admin/products')
  revalidatePath('/store')
  return { success: true }
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
