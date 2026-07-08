'use server'

import { revalidatePath, revalidateTag } from 'next/cache'

import { createSupabaseAdminClient } from '@/config/supabase'
import { getCurrentUser } from '@/modules/auth/queries'
import { balanceTag } from '@/modules/shop/queries'

import { sendGratitudeSchema } from './types'
import type { SendGratitudeInput } from './types'
import { getSenderQuota } from './queries'

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

  // 3. Нельзя самому себе (без похода в БД)
  if (recipient_id === senderId) {
    return { success: false, error: 'Нельзя отправить благодарность самому себе' }
  }

  if (type === 'gift' && gift_source === 'balance' && coins_amount <= 0) {
    return { success: false, error: 'Укажите сумму подарка' }
  }

  const supabase = createSupabaseAdminClient()

  // 4. Параллельно: отправитель + получатель одной выборкой, квота — только для подарка по ней.
  // Баланс здесь не проверяем: триггер списывает атомарно и кидает исключение при нехватке.
  const [usersRes, quota] = await Promise.all([
    supabase
      .from('ws_users')
      .select('id, email')
      .in('id', [senderId, recipient_id])
      .eq('is_active', true),
    type === 'gift' && gift_source === 'quota' ? getSenderQuota(senderId) : Promise.resolve(null),
  ])

  const users = usersRes.data ?? []
  const senderOk = users.some(
    (u) => u.id === senderId && u.email?.toLowerCase() === currentUser.email.toLowerCase()
  )
  if (!senderOk) {
    return { success: false, error: 'Не авторизован' }
  }
  if (!users.some((u) => u.id === recipient_id)) {
    return { success: false, error: 'Получатель не найден или неактивен' }
  }
  if (quota?.used) {
    return { success: false, error: 'Бесплатная квота уже использована. Следующая доступна ' + (quota.next_quota_date ?? 'позже') }
  }

  // 5. INSERT — триггер fn_award_gratitude_points_v2 сделает остальное
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
    // P0001 — RAISE EXCEPTION из триггера при нехватке баланса
    if (error.code === 'P0001' && error.message.includes('Insufficient balance')) {
      return { success: false, error: 'Недостаточно 💎' }
    }
    console.error('sendGratitude:', error.message)
    return { success: false, error: 'Не удалось отправить. Попробуйте ещё раз' }
  }

  if (type === 'gift' && gift_source === 'balance') {
    revalidateTag(balanceTag(senderId), 'max')
  }
  // Подарок засчитывается в достижения получателя — сбрасываем его кэш прогресса,
  // чтобы прогресс-бар был свежим при навигации/обновлении (live идёт через realtime)
  if (type === 'gift') {
    revalidateTag(`achievements:${recipient_id}`, 'max')
  }
  revalidatePath('/')
  revalidatePath('/activity')
  revalidatePath('/gratitudes')
  return { success: true }
}
