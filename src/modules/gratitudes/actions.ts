'use server'

import { revalidatePath } from 'next/cache'

import { createSupabaseAdminClient } from '@/config/supabase'
import { getCurrentUser } from '@/modules/auth/queries'

import { sendGratitudeSchema } from './types'
import type { SendGratitudeInput } from './types'

export async function sendGratitude(
  senderId: string,
  input: SendGratitudeInput
): Promise<{ success: true } | { success: false; error: string }> {
  // 1. Валидация входных данных
  const parsed = sendGratitudeSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message }
  }

  const { recipient_id, message, category, type, gift_source, coins_amount } = parsed.data

  // 2. Проверка авторизации: senderId принадлежит текущему пользователю
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { success: false, error: 'Не авторизован' }
  }

  const supabase = createSupabaseAdminClient()

  const { data: wsUser } = await supabase
    .from('ws_users')
    .select('id')
    .eq('email', currentUser.email.toLowerCase())
    .eq('id', senderId)
    .eq('is_active', true)
    .maybeSingle()

  if (!wsUser) {
    return { success: false, error: 'Не авторизован' }
  }

  // 3. Нельзя самому себе
  if (recipient_id === senderId) {
    return { success: false, error: 'Нельзя отправить благодарность самому себе' }
  }

  // 4. Проверка что получатель активен
  const { data: recipient } = await supabase
    .from('ws_users')
    .select('id')
    .eq('id', recipient_id)
    .eq('is_active', true)
    .maybeSingle()

  if (!recipient) {
    return { success: false, error: 'Получатель не найден или неактивен' }
  }

  // 5. Для подарка за свой счёт — предварительная проверка баланса
  // Атомарная защита от race condition в триггере (RAISE EXCEPTION если недостаточно)
  if (type === 'gift' && gift_source === 'balance') {
    if (coins_amount <= 0) {
      return { success: false, error: 'Укажите сумму подарка' }
    }

    const { data: balance } = await supabase
      .from('gamification_balances')
      .select('total_coins')
      .eq('user_id', senderId)
      .single()

    if (!balance || balance.total_coins < coins_amount) {
      return { success: false, error: 'Недостаточно баллов' }
    }
  }

  // 6. INSERT — триггер fn_award_gratitude_points_v2 сделает остальное
  const { error } = await supabase.from('gratitudes').insert({
    sender_id: senderId,
    recipient_id,
    message,
    category,
    type,
    gift_source: type === 'gift' ? gift_source : null,
    coins_amount: type === 'gift' && gift_source === 'balance' ? coins_amount : 0,
  })

  if (error) {
    console.error('sendGratitude:', error.message)
    return { success: false, error: 'Не удалось отправить. Попробуйте ещё раз' }
  }

  revalidatePath('/')
  return { success: true }
}
