import { createSupabaseAdminClient } from '@/config/supabase'

import type { LotteryDraw, LotteryWithStats, UserTicketInfo } from './types'

// Категория "Розыгрыши" — slug: draw
const DRAW_CATEGORY_SLUG = 'draw'

/**
 * Активная лотерея со статистикой (билеты, участники)
 */
export async function getActiveLottery(): Promise<LotteryWithStats | null> {
  const supabase = createSupabaseAdminClient()

  const { data } = await supabase
    .from('lottery_draws')
    .select('*')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!data) return null

  const stats = await getTicketStats(supabase, data.product_id)

  return { ...data, ...stats }
}

/**
 * История завершённых лотерей с победителями.
 * Все данные одним батч-запросом (без N+1).
 */
export async function getLotteryHistory(): Promise<LotteryWithStats[]> {
  const supabase = createSupabaseAdminClient()

  const { data, error } = await supabase
    .from('lottery_draws')
    .select('*')
    .eq('status', 'completed')
    .order('month', { ascending: false })

  if (error || !data || data.length === 0) return []

  return enrichLotteriesWithStats(supabase, data)
}

/**
 * Все лотереи для админки (active + completed).
 * Все данные одним батч-запросом (без N+1).
 */
export async function getAllLotteries(): Promise<LotteryWithStats[]> {
  const supabase = createSupabaseAdminClient()

  const { data, error } = await supabase
    .from('lottery_draws')
    .select('*')
    .order('month', { ascending: false })

  if (error || !data || data.length === 0) return []

  return enrichLotteriesWithStats(supabase, data)
}

/**
 * Количество билетов пользователя + шанс выигрыша
 */
export async function getUserTicketInfo(
  wsUserId: string,
  productId: string
): Promise<UserTicketInfo> {
  const supabase = createSupabaseAdminClient()

  // Оба запроса параллельно
  const [userResult, totalResult] = await Promise.all([
    supabase
      .from('shop_orders')
      .select('*', { count: 'exact', head: true })
      .eq('product_id', productId)
      .eq('user_id', wsUserId)
      .neq('status', 'cancelled'),
    supabase
      .from('shop_orders')
      .select('*', { count: 'exact', head: true })
      .eq('product_id', productId)
      .neq('status', 'cancelled'),
  ])

  const ticketCount = userResult.count ?? 0
  const totalTickets = totalResult.count ?? 0

  return {
    ticket_count: ticketCount,
    total_tickets: totalTickets,
    chance_percent: totalTickets > 0 ? Math.round((ticketCount / totalTickets) * 10000) / 100 : 0,
  }
}

/**
 * ID категории "Розыгрыши"
 */
export async function getDrawCategoryId(): Promise<string | null> {
  const supabase = createSupabaseAdminClient()

  const { data } = await supabase
    .from('shop_categories')
    .select('id')
    .eq('slug', DRAW_CATEGORY_SLUG)
    .maybeSingle()

  return data?.id ?? null
}

// --- Вспомогательные ---

interface TicketStats {
  total_tickets: number
  total_participants: number
}

/**
 * Обогащает массив лотерей статистикой и данными победителей.
 * Батчит запросы: 1 запрос на все билеты + 1 на всех победителей.
 */
async function enrichLotteriesWithStats(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  lotteries: LotteryDraw[]
): Promise<LotteryWithStats[]> {
  const productIds = lotteries.map((l) => l.product_id)
  const winnerIds = lotteries
    .map((l) => l.winner_user_id)
    .filter((id): id is string => id !== null)

  // Батч: все билеты для всех лотерей + все победители
  const [ordersResult, winnersResult] = await Promise.all([
    supabase
      .from('shop_orders')
      .select('product_id, user_id')
      .in('product_id', productIds)
      .neq('status', 'cancelled'),
    winnerIds.length > 0
      ? supabase
          .from('ws_users')
          .select('id, first_name, last_name, department')
          .in('id', winnerIds)
      : Promise.resolve({ data: [] as { id: string; first_name: string; last_name: string; department: string | null }[] }),
  ])

  const orders = ordersResult.data ?? []
  const winners = winnersResult.data ?? []

  // Группируем статистику по product_id
  const statsMap = new Map<string, TicketStats>()
  for (const productId of productIds) {
    const productOrders = orders.filter((o) => o.product_id === productId)
    statsMap.set(productId, {
      total_tickets: productOrders.length,
      total_participants: new Set(productOrders.map((o) => o.user_id)).size,
    })
  }

  // Индекс победителей по id
  const winnerMap = new Map(winners.map((w) => [w.id, w]))

  return lotteries.map((lottery) => {
    const stats = statsMap.get(lottery.product_id) ?? { total_tickets: 0, total_participants: 0 }
    const winnerData = lottery.winner_user_id ? winnerMap.get(lottery.winner_user_id) : undefined

    return {
      ...lottery,
      ...stats,
      winner: winnerData
        ? { first_name: winnerData.first_name, last_name: winnerData.last_name, department: winnerData.department }
        : undefined,
    }
  })
}

async function getTicketStats(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  productId: string
): Promise<TicketStats> {
  const { data } = await supabase
    .from('shop_orders')
    .select('user_id')
    .eq('product_id', productId)
    .neq('status', 'cancelled')

  const orders = data ?? []

  return {
    total_tickets: orders.length,
    total_participants: new Set(orders.map((o) => o.user_id)).size,
  }
}
