'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { createSupabaseAdminClient } from '@/config/supabase'
import { getCurrentUser } from '@/modules/auth'
import { checkIsAdmin } from '@/modules/admin/checkIsAdmin'
import { balanceTag } from '@/modules/shop/queries'
import type { ShieldType } from './types'

function validType(value: string): value is ShieldType {
  return value === 'ws' || value === 'revit'
}

export async function buyStreakShield(shieldType: ShieldType): Promise<{ success: true } | { success: false; error: string }> {
  if (!validType(shieldType)) return { success: false, error: 'Неверный тип защиты' }
  const user = await getCurrentUser()
  if (!user?.wsUserId) return { success: false, error: 'Пользователь не найден' }
  const { data, error } = await createSupabaseAdminClient().rpc('use_streak_shield', {
    p_user_id: user.wsUserId, p_shield_type: shieldType, p_automatic: false,
  })
  if (error) return { success: false, error: error.message }
  if (!data) return { success: false, error: 'Нет доступной защиты или время спасения истекло' }
  revalidateTag(balanceTag(user.wsUserId), 'max')
  revalidatePath('/')
  revalidatePath('/store')
  revalidatePath('/profile')
  return { success: true }
}

export async function purchaseStreakShieldCredit(shieldType: ShieldType): Promise<{ success: true } | { success: false; error: string }> {
  if (!validType(shieldType)) return { success: false, error: 'Неверный тип защиты' }
  const user = await getCurrentUser()
  if (!user?.wsUserId) return { success: false, error: 'Пользователь не найден' }
  const { error } = await createSupabaseAdminClient().rpc('purchase_streak_shield_credit', {
    p_user_id: user.wsUserId, p_shield_type: shieldType,
  })
  if (error) return { success: false, error: error.message.includes('Недостаточно') ? 'Недостаточно 💎' : error.message }
  revalidateTag(balanceTag(user.wsUserId), 'max')
  revalidatePath('/store')
  revalidatePath('/profile')
  return { success: true }
}

export async function setStreakShieldAutoEnabled(enabled: boolean): Promise<{ success: true } | { success: false; error: string }> {
  if (typeof enabled !== 'boolean' || !await checkIsAdmin()) return { success: false, error: 'Доступ запрещён' }
  const { error } = await createSupabaseAdminClient().from('streak_shield_settings')
    .update({ auto_enabled: enabled, updated_at: new Date().toISOString() }).eq('id', true)
  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/shields')
  return { success: true }
}
