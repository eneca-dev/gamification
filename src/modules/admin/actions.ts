'use server'

import { revalidatePath } from 'next/cache'

import { createSupabaseAdminClient } from '@/config/supabase'

import { getCurrentUser } from '@/modules/auth'

import { checkIsAdmin } from './checkIsAdmin'
import { updateEventTypeSchema, updateOrderStatusSchema, cancelOrderSchema } from './types'
import type { CancelResult } from '@/modules/shop'

export async function updateEventType(
  input: { key: string; name?: string; coins?: number; description?: string | null; is_active?: boolean }
): Promise<{ success: true } | { success: false; error: string }> {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) return { success: false, error: 'Доступ запрещён' }

  const parsed = updateEventTypeSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Невалидные данные' }

  const { key, ...fields } = parsed.data

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (fields.name !== undefined) updateData.name = fields.name
  if (fields.coins !== undefined) updateData.coins = fields.coins
  if (fields.description !== undefined) updateData.description = fields.description
  if (fields.is_active !== undefined) updateData.is_active = fields.is_active

  const supabase = createSupabaseAdminClient()

  const { data, error } = await supabase
    .from('gamification_event_types')
    .update(updateData)
    .eq('key', key)
    .select('key')

  if (error) return { success: false, error: error.message }

  // RLS может молча заблокировать UPDATE — проверяем что строка обновилась
  if (!data || data.length === 0) {
    return { success: false, error: 'Не удалось обновить: проверьте права доступа' }
  }

  revalidatePath('/admin/events')
  return { success: true }
}

export async function toggleAdmin(
  userId: string
): Promise<{ success: true; isAdmin: boolean } | { success: false; error: string }> {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) return { success: false, error: 'Доступ запрещён' }

  const supabase = createSupabaseAdminClient()

  // Читаем текущее значение
  const { data: user, error: readError } = await supabase
    .from('ws_users')
    .select('is_admin')
    .eq('id', userId)
    .single()

  if (readError || !user) return { success: false, error: 'Пользователь не найден' }

  const newValue = !user.is_admin

  const { error } = await supabase
    .from('ws_users')
    .update({ is_admin: newValue })
    .eq('id', userId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/admin/users')
  return { success: true, isAdmin: newValue }
}

export async function updateOrderStatus(
  input: unknown
): Promise<{ success: true } | { success: false; error: string }> {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) return { success: false, error: 'Доступ запрещён' }

  const parsed = updateOrderStatusSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Невалидные данные' }

  const user = await getCurrentUser()
  if (!user?.wsUserId) return { success: false, error: 'Пользователь не найден' }

  const { orderId, status, note } = parsed.data
  const supabase = createSupabaseAdminClient()

  const updateData: Record<string, unknown> = {
    status,
    status_changed_by: user.wsUserId,
    status_changed_at: new Date().toISOString(),
  }
  if (note !== undefined) updateData.note = note

  const { data, error } = await supabase
    .from('shop_orders')
    .update(updateData)
    .eq('id', orderId)
    .neq('status', 'cancelled')
    .select('id')

  if (error) return { success: false, error: error.message }
  if (!data || data.length === 0) return { success: false, error: 'Заказ не найден или уже отменён' }

  revalidatePath('/admin/orders')
  revalidatePath('/store/orders')
  return { success: true }
}

export async function cancelOrder(
  input: unknown
): Promise<{ success: true; data: CancelResult } | { success: false; error: string }> {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) return { success: false, error: 'Доступ запрещён' }

  const parsed = cancelOrderSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Невалидные данные' }

  const user = await getCurrentUser()
  if (!user?.wsUserId) return { success: false, error: 'Пользователь не найден' }

  const { orderId, note } = parsed.data
  const supabase = createSupabaseAdminClient()

  const { data, error } = await supabase.rpc('cancel_order', {
    p_order_id: orderId,
    p_admin_id: user.wsUserId,
    p_note: note ?? null,
  })

  if (error) {
    const msg = error.message
    if (msg.includes('не найден')) return { success: false, error: 'Заказ не найден' }
    if (msg.includes('уже отменён')) return { success: false, error: 'Заказ уже отменён' }
    if (msg.includes('уже выполнен')) return { success: false, error: 'Возврат уже выполнен' }
    return { success: false, error: 'Ошибка при отмене заказа' }
  }

  revalidatePath('/admin/orders')
  revalidatePath('/store/orders')
  revalidatePath('/store')
  revalidatePath('/profile')
  return { success: true, data: data as CancelResult }
}
