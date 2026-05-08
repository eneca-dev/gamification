'use server'

import { revalidatePath } from 'next/cache'

import { createSupabaseAdminClient } from '@/config/supabase'
import { getCurrentUser } from '@/modules/auth'
import { checkIsAdmin } from '@/modules/admin/checkIsAdmin'
import { getCurrentRate } from '@/modules/shop'
import { computePriceCrystals } from '@/modules/shop/index.client'

import type { ActionResult } from '@/modules/cache'

import { createLotterySchema, updateLotterySchema } from './types'
import type { LotteryDraw } from './types'
import { getDrawCategoryId, getActiveLottery } from './queries'

/**
 * Создание лотереи на текущий месяц.
 * Автоматически создаёт shop_product (билет) в категории "Розыгрыши".
 */
export async function createLottery(input: unknown): Promise<ActionResult<LotteryDraw>> {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) return { success: false, error: 'Доступ запрещён' }

  const user = await getCurrentUser()
  if (!user?.wsUserId) return { success: false, error: 'Пользователь не найден' }

  const parsed = createLotterySchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message }
  }

  // Проверяем что нет активной лотереи
  const active = await getActiveLottery()
  if (active) {
    return { success: false, error: 'Уже есть активная лотерея. Дождитесь завершения текущей.' }
  }

  const categoryId = await getDrawCategoryId()
  if (!categoryId) {
    return { success: false, error: 'Категория "Розыгрыши" не найдена. Создайте категорию со slug "draw".' }
  }

  const supabase = createSupabaseAdminClient()
  const { name, description, image_url, cost_byn } = parsed.data

  // Конвертация BYN → кристаллы по текущему курсу. coefficient = 1 (для лотереи без наценки).
  const rate = await getCurrentRate()
  const ticketPriceCrystals = computePriceCrystals(cost_byn, 1, rate)

  // 1-е число текущего месяца по Минску (UTC+3)
  const nowMinsk = new Date(Date.now() + 3 * 60 * 60 * 1000)
  const monthStart = new Date(Date.UTC(nowMinsk.getUTCFullYear(), nowMinsk.getUTCMonth(), 1))
    .toISOString()
    .split('T')[0]

  // 1. Создаём товар-билет (цена в магазине считается из cost_byn × coefficient × rate)
  const { data: product, error: productError } = await supabase
    .from('shop_products')
    .insert({
      name: `Билет на розыгрыш: ${name}`,
      description: description ?? `Лотерейный билет. Приз: ${name}`,
      cost_byn,
      coefficient: 1,
      category_id: categoryId,
      emoji: '🎟️',
      is_active: true,
      stock: null,
      sort_order: 0,
      created_by: user.wsUserId,
    })
    .select('id')
    .single()

  if (productError || !product) {
    return { success: false, error: `Ошибка создания билета: ${productError?.message}` }
  }

  // 2. Создаём лотерею (ticket_price — закэшированная цена в кристаллах на момент создания)
  const { data: lottery, error: lotteryError } = await supabase
    .from('lottery_draws')
    .insert({
      name,
      description: description ?? null,
      image_url: image_url ?? null,
      ticket_price: ticketPriceCrystals,
      product_id: product.id,
      status: 'active',
      month: monthStart,
      created_by: user.wsUserId,
    })
    .select('*')
    .single()

  if (lotteryError) {
    // Откат: удаляем созданный товар
    await supabase.from('shop_products').delete().eq('id', product.id)

    if (lotteryError.message.includes('lottery_draws_month_key')) {
      return { success: false, error: 'Лотерея на этот месяц уже существует' }
    }
    return { success: false, error: `Ошибка создания лотереи: ${lotteryError.message}` }
  }

  revalidatePath('/admin/lottery')
  revalidatePath('/store')

  return { success: true, data: lottery }
}

/**
 * Обновление приза активной лотереи.
 * Обновляет и lottery_draws, и связанный shop_product (билет).
 */
export async function updateLottery(input: unknown): Promise<ActionResult<LotteryDraw>> {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) return { success: false, error: 'Доступ запрещён' }

  const parsed = updateLotterySchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message }
  }

  const { id, name, description, image_url, cost_byn } = parsed.data
  const supabase = createSupabaseAdminClient()

  // Конвертация BYN → кристаллы по текущему курсу. coefficient = 1.
  const rate = await getCurrentRate()
  const ticketPriceCrystals = computePriceCrystals(cost_byn, 1, rate)

  // Получаем текущую лотерею
  const { data: current, error: fetchError } = await supabase
    .from('lottery_draws')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !current) {
    return { success: false, error: 'Лотерея не найдена' }
  }

  // Обновляем лотерею
  const { data: lottery, error: lotteryError } = await supabase
    .from('lottery_draws')
    .update({
      name,
      description: description ?? null,
      image_url: image_url ?? null,
      ticket_price: ticketPriceCrystals,
    })
    .eq('id', id)
    .select('*')
    .single()

  if (lotteryError || !lottery) {
    return { success: false, error: `Ошибка обновления лотереи: ${lotteryError?.message}` }
  }

  // Обновляем связанный товар-билет
  await supabase
    .from('shop_products')
    .update({
      name: `Билет на розыгрыш: ${name}`,
      description: description ?? `Лотерейный билет. Приз: ${name}`,
      cost_byn,
      coefficient: 1,
      image_url: image_url ?? null,
    })
    .eq('id', current.product_id)

  revalidatePath('/admin/lottery')
  revalidatePath('/store')

  return { success: true, data: lottery }
}
