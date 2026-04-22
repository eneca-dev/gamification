'use server'

import { revalidatePath } from 'next/cache'

import { createSupabaseAdminClient } from '@/config/supabase'
import { getCurrentUser } from '@/modules/auth'

import type { ShieldType } from './types'

/**
 * Покупка второй жизни для стрика.
 * Доступна только при наличии pending_reset (красный день / пропуск плагина).
 *
 * 1. Проверяет pending в streak-таблице
 * 2. Проверяет что grace period не истёк
 * 3. Покупает товар через purchase_product (списание 💎)
 * 4. Очищает pending в streak-таблице
 * 5. Записывает лог в streak_shield_log
 */
export async function buyStreakShield(
  shieldType: ShieldType,
): Promise<{ success: true } | { success: false; error: string }> {
  const user = await getCurrentUser()
  if (!user?.wsUserId) return { success: false, error: 'Пользователь не найден' }

  const supabase = createSupabaseAdminClient()

  // 1. Проверяем pending в нужной streak-таблице
  const streakTable = shieldType === 'ws' ? 'ws_user_streaks' : 'revit_user_streaks'

  const { data: streakRow, error: streakError } = await supabase
    .from(streakTable)
    .select('pending_reset_date, pending_reset_expires_at, current_streak')
    .eq('user_id', user.wsUserId)
    .maybeSingle()

  if (streakError) return { success: false, error: 'Ошибка при проверке стрика' }
  if (!streakRow?.pending_reset_date) return { success: false, error: 'Нет угрозы стрику' }

  // 2. Проверяем grace period
  if (!streakRow.pending_reset_expires_at) return { success: false, error: 'Время на покупку истекло' }
  const expiresAt = new Date(streakRow.pending_reset_expires_at)
  if (expiresAt <= new Date()) return { success: false, error: 'Время на покупку истекло' }

  // 3. Находим товар по effect
  const effectKey = shieldType === 'ws' ? 'streak_shield_ws' : 'streak_shield_revit'

  const { data: product, error: productError } = await supabase
    .from('shop_products')
    .select('id, price')
    .eq('effect', effectKey)
    .eq('is_active', true)
    .single()

  if (productError || !product) return { success: false, error: 'Товар не найден' }

  // 4. Покупаем через purchase_product (атомарное списание)
  const { data: purchaseData, error: purchaseError } = await supabase.rpc('purchase_product', {
    p_product_id: product.id,
    p_user_id: user.wsUserId,
  })

  if (purchaseError) {
    const msg = purchaseError.message
    if (msg.includes('Недостаточно 💎')) return { success: false, error: 'Недостаточно 💎' }
    return { success: false, error: 'Ошибка при покупке' }
  }

  const orderId = (purchaseData as { order_id?: string } | null)?.order_id
  if (!orderId) return { success: false, error: 'Ошибка при покупке' }

  // 5. Очищаем pending в streak-таблице
  const clearFields = shieldType === 'ws'
    ? { pending_reset_date: null, pending_reset_expires_at: null, updated_at: new Date().toISOString() }
    : { pending_reset_date: null, pending_reset_expires_at: null, pending_gap_days: null, updated_at: new Date().toISOString() }

  const { error: clearError } = await supabase
    .from(streakTable)
    .update(clearFields)
    .eq('user_id', user.wsUserId)

  if (clearError) {
    // Покупка прошла, но pending не очистился — записываем лог с маркером аномалии
    await supabase.from('streak_shield_log').insert({
      user_id: user.wsUserId,
      shield_type: shieldType,
      protected_date: streakRow.pending_reset_date,
      order_id: orderId,
      notes: 'pending_clear_failed',
    })
    revalidatePath('/')
    revalidatePath('/store')
    return { success: true }
  }

  // 6. Записываем лог
  await supabase.from('streak_shield_log').insert({
    user_id: user.wsUserId,
    shield_type: shieldType,
    protected_date: streakRow.pending_reset_date,
    order_id: orderId,
  })

  revalidatePath('/')
  revalidatePath('/store')
  return { success: true }
}
