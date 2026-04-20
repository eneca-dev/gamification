'use server'

import { revalidatePath } from 'next/cache'

import { createSupabaseAdminClient } from '@/config/supabase'

import { getCurrentUser } from '@/modules/auth'

import { checkIsAdmin } from './checkIsAdmin'
import {
  updateEventTypeSchema, updateOrderStatusSchema, cancelOrderSchema,
  addCalendarDateSchema, deleteCalendarDateSchema,
  updateRankingSettingSchema, updateGratitudeSettingSchema,
} from './types'
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

export async function updateRankingSetting(
  input: { area: string; entity_type: string; threshold?: number; is_active?: boolean }
): Promise<{ success: true } | { success: false; error: string }> {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) return { success: false, error: 'Доступ запрещён' }

  const parsed = updateRankingSettingSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Невалидные данные' }

  const { area, entity_type, ...fields } = parsed.data
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (fields.threshold !== undefined) updateData.threshold = fields.threshold
  if (fields.is_active !== undefined) updateData.is_active = fields.is_active

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('ach_ranking_settings')
    .update(updateData)
    .eq('area', area)
    .eq('entity_type', entity_type)
    .select('area')

  if (error) return { success: false, error: error.message }
  if (!data || data.length === 0) return { success: false, error: 'Не удалось обновить' }

  revalidatePath('/admin/events')
  return { success: true }
}

export async function updateGratitudeSetting(
  input: { category: string; achievement_name?: string; threshold?: number; bonus_coins?: number; is_active?: boolean }
): Promise<{ success: true } | { success: false; error: string }> {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) return { success: false, error: 'Доступ запрещён' }

  const parsed = updateGratitudeSettingSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Невалидные данные' }

  const { category, ...fields } = parsed.data
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (fields.achievement_name !== undefined) updateData.achievement_name = fields.achievement_name
  if (fields.threshold !== undefined) updateData.threshold = fields.threshold
  if (fields.bonus_coins !== undefined) updateData.bonus_coins = fields.bonus_coins
  if (fields.is_active !== undefined) updateData.is_active = fields.is_active

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('ach_gratitude_settings')
    .update(updateData)
    .eq('category', category)
    .select('category')

  if (error) return { success: false, error: error.message }
  if (!data || data.length === 0) return { success: false, error: 'Не удалось обновить' }

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

export async function toggleBetaTester(
  userId: string
): Promise<{ success: true; isBetaTester: boolean } | { success: false; error: string }> {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) return { success: false, error: 'Доступ запрещён' }

  const supabase = createSupabaseAdminClient()

  const { data: user, error: readError } = await supabase
    .from('ws_users')
    .select('is_beta_tester')
    .eq('id', userId)
    .single()

  if (readError || !user) return { success: false, error: 'Пользователь не найден' }

  const newValue = !user.is_beta_tester

  const { error } = await supabase
    .from('ws_users')
    .update({ is_beta_tester: newValue })
    .eq('id', userId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/admin/users')
  return { success: true, isBetaTester: newValue }
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

// --- Calendar ---

export async function addCalendarHoliday(
  input: unknown
): Promise<{ success: true; data: { id: number; date: string; name: string; created_at: string } } | { success: false; error: string }> {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) return { success: false, error: 'Доступ запрещён' }

  const parsed = addCalendarDateSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message ?? 'Невалидные данные' }

  const supabase = createSupabaseAdminClient()

  // Проверяем что дата не в calendar_workdays
  const { data: existing } = await supabase
    .from('calendar_workdays')
    .select('id')
    .eq('date', parsed.data.date)
    .maybeSingle()

  if (existing) return { success: false, error: 'Эта дата уже отмечена как рабочий перенос. Сначала удалите её оттуда' }

  const { data, error } = await supabase
    .from('calendar_holidays')
    .insert({ date: parsed.data.date, name: parsed.data.name })
    .select('id, date, name, created_at')
    .single()

  if (error) {
    if (error.code === '23505') return { success: false, error: 'Эта дата уже добавлена как праздник' }
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/calendar')
  return { success: true, data }
}

export async function deleteCalendarHoliday(
  input: unknown
): Promise<{ success: true } | { success: false; error: string }> {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) return { success: false, error: 'Доступ запрещён' }

  const parsed = deleteCalendarDateSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Невалидные данные' }

  const supabase = createSupabaseAdminClient()

  const { error } = await supabase
    .from('calendar_holidays')
    .delete()
    .eq('id', parsed.data.id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/admin/calendar')
  return { success: true }
}

export async function addCalendarWorkday(
  input: unknown
): Promise<{ success: true; data: { id: number; date: string; name: string; created_at: string } } | { success: false; error: string }> {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) return { success: false, error: 'Доступ запрещён' }

  const parsed = addCalendarDateSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message ?? 'Невалидные данные' }

  const supabase = createSupabaseAdminClient()

  // Проверяем что дата не в calendar_holidays
  const { data: existing } = await supabase
    .from('calendar_holidays')
    .select('id')
    .eq('date', parsed.data.date)
    .maybeSingle()

  if (existing) return { success: false, error: 'Эта дата уже отмечена как праздник. Сначала удалите её оттуда' }

  const { data, error } = await supabase
    .from('calendar_workdays')
    .insert({ date: parsed.data.date, name: parsed.data.name })
    .select('id, date, name, created_at')
    .single()

  if (error) {
    if (error.code === '23505') return { success: false, error: 'Эта дата уже добавлена как рабочий перенос' }
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/calendar')
  return { success: true, data }
}

export async function deleteCalendarWorkday(
  input: unknown
): Promise<{ success: true } | { success: false; error: string }> {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) return { success: false, error: 'Доступ запрещён' }

  const parsed = deleteCalendarDateSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Невалидные данные' }

  const supabase = createSupabaseAdminClient()

  const { error } = await supabase
    .from('calendar_workdays')
    .delete()
    .eq('id', parsed.data.id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/admin/calendar')
  return { success: true }
}
