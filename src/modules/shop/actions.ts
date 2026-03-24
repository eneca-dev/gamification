'use server'

import { revalidatePath } from 'next/cache'

import { createSupabaseAdminClient } from '@/config/supabase'
import { getCurrentUser } from '@/modules/auth'
import { checkIsAdmin } from '@/modules/admin/checkIsAdmin'

import {
  createProductSchema,
  updateProductSchema,
  createCategorySchema,
  updateCategorySchema,
} from './types'
import type { PurchaseResult, CancelResult } from './types'

// --- Покупка (доступна всем авторизованным) ---

export async function purchaseProduct(
  productId: string
): Promise<{ success: true; data: PurchaseResult } | { success: false; error: string }> {
  const user = await getCurrentUser()
  if (!user?.wsUserId) return { success: false, error: 'Пользователь не найден в системе' }

  const supabase = createSupabaseAdminClient()

  const { data, error } = await supabase.rpc('purchase_product', {
    p_product_id: productId,
    p_user_id: user.wsUserId,
  })

  if (error) {
    const msg = error.message
    if (msg.includes('Недостаточно коинов')) return { success: false, error: 'Недостаточно коинов' }
    if (msg.includes('Нет в наличии')) return { success: false, error: 'Нет в наличии' }
    if (msg.includes('недоступен')) return { success: false, error: 'Товар недоступен' }
    return { success: false, error: 'Ошибка при покупке' }
  }

  revalidatePath('/store')
  revalidatePath('/profile')
  return { success: true, data: data as PurchaseResult }
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

  const { data, error } = await supabase
    .from('shop_products')
    .insert({ ...parsed.data, created_by: user.wsUserId })
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
