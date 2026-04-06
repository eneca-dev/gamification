'use server'

import { revalidatePath } from 'next/cache'

import { createSupabaseAdminClient } from '@/config/supabase'
import { getCurrentUser } from '@/modules/auth'
import { checkIsAdmin } from '@/modules/admin/checkIsAdmin'

import type { ActionResult } from '@/modules/cache'

import { createLotterySchema } from './types'
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
  const { name, description, image_url, ticket_price } = parsed.data

  // 1-е число текущего месяца по Минску (UTC+3)
  const nowMinsk = new Date(Date.now() + 3 * 60 * 60 * 1000)
  const monthStart = new Date(Date.UTC(nowMinsk.getUTCFullYear(), nowMinsk.getUTCMonth(), 1))
    .toISOString()
    .split('T')[0]

  // 1. Создаём товар-билет
  const { data: product, error: productError } = await supabase
    .from('shop_products')
    .insert({
      name: `Билет на розыгрыш: ${name}`,
      description: description ?? `Лотерейный билет. Приз: ${name}`,
      price: ticket_price,
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

  // 2. Создаём лотерею
  const { data: lottery, error: lotteryError } = await supabase
    .from('lottery_draws')
    .insert({
      name,
      description: description ?? null,
      image_url: image_url ?? null,
      ticket_price,
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
