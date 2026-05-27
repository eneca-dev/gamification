import { createSupabaseAdminClient } from '@/config/supabase'

import { FREE_SHIELDS_PER_MONTH } from './types'
import type { PendingReset, ShieldLogEntry, ShieldQuota, ShieldType } from './types'

function currentMonthStart(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

// Получить pending resets для текущего пользователя (для UI)
export async function getPendingResets(userId: string): Promise<PendingReset[]> {
  // Admin client: streak_shield_quota RLS требует my_ws_user_id() совпадающего
  // с auth email, что ломается при несовпадающих email (admin, dev impersonation).
  // Функция вызывается только серверно с уже аутентифицированным userId.
  const supabase = createSupabaseAdminClient()
  const result: PendingReset[] = []

  const now = new Date().toISOString()
  const month = currentMonthStart()

  const [wsStreak, revitStreak, shieldProducts, crystalRate, quotaRows] = await Promise.all([
    supabase
      .from('ws_user_streaks')
      .select('pending_reset_date, pending_reset_expires_at, current_streak')
      .eq('user_id', userId)
      .not('pending_reset_date', 'is', null)
      .gt('pending_reset_expires_at', now)
      .maybeSingle(),

    // Revit pending — view возвращает frozen current_streak во время грейса
    supabase
      .from('revit_user_streaks_effective')
      .select('pending_reset_date, pending_reset_expires_at, current_streak')
      .eq('user_id', userId)
      .not('pending_reset_date', 'is', null)
      .gt('pending_reset_expires_at', now)
      .maybeSingle(),

    supabase
      .from('shop_products')
      .select('id, cost_byn, coefficient, effect')
      .in('effect', ['streak_shield_ws', 'streak_shield_revit'])
      .eq('is_active', true),

    supabase.rpc('current_crystal_rate'),

    supabase
      .from('streak_shield_quota')
      .select('shield_type, free_used')
      .eq('user_id', userId)
      .eq('month', month),
  ])

  const rate = Number(crystalRate.data ?? 0)
  const productMap = new Map<string, { id: string; price: number }>()
  for (const p of shieldProducts.data ?? []) {
    const price = Math.round(Number(p.cost_byn) * Number(p.coefficient) * rate)
    productMap.set(p.effect as string, { id: p.id, price })
  }

  const quotaMap = new Map<string, number>()
  for (const q of quotaRows.data ?? []) {
    quotaMap.set(q.shield_type, q.free_used)
  }

  if (wsStreak.data) {
    const product = productMap.get('streak_shield_ws')
    if (product) {
      const freeUsed = quotaMap.get('ws') ?? 0
      result.push({
        type: 'ws',
        pendingResetDate: wsStreak.data.pending_reset_date,
        expiresAt: wsStreak.data.pending_reset_expires_at,
        currentStreak: wsStreak.data.current_streak ?? 0,
        price: product.price,
        productId: product.id,
        freeUsesLeft: Math.max(0, FREE_SHIELDS_PER_MONTH - freeUsed),
      })
    }
  }

  if (revitStreak.data) {
    const product = productMap.get('streak_shield_revit')
    if (product) {
      const freeUsed = quotaMap.get('revit') ?? 0
      result.push({
        type: 'revit',
        pendingResetDate: revitStreak.data.pending_reset_date,
        expiresAt: revitStreak.data.pending_reset_expires_at,
        currentStreak: revitStreak.data.current_streak ?? 0,
        price: product.price,
        productId: product.id,
        freeUsesLeft: Math.max(0, FREE_SHIELDS_PER_MONTH - freeUsed),
      })
    }
  }

  return result
}

// Квота бесплатных жизней текущего месяца для UI (карточка товара, профиль)
export async function getShieldQuota(userId: string): Promise<ShieldQuota> {
  const supabase = createSupabaseAdminClient()
  const month = currentMonthStart()

  const { data } = await supabase
    .from('streak_shield_quota')
    .select('shield_type, free_used, paid_used')
    .eq('user_id', userId)
    .eq('month', month)

  const empty = () => ({ freeUsed: 0, paidUsed: 0, freeLeft: FREE_SHIELDS_PER_MONTH })
  const quota: ShieldQuota = { ws: empty(), revit: empty() }

  for (const row of data ?? []) {
    const type = row.shield_type as ShieldType
    quota[type] = {
      freeUsed: row.free_used,
      paidUsed: row.paid_used,
      freeLeft: Math.max(0, FREE_SHIELDS_PER_MONTH - row.free_used),
    }
  }

  return quota
}

// Даты, где был использован щит (для календаря)
export async function getShieldDatesInRange(
  userId: string,
  rangeStart: string,
  rangeEnd: string,
): Promise<Map<string, ShieldType>> {
  const supabase = createSupabaseAdminClient()

  const { data, error } = await supabase
    .from('streak_shield_log')
    .select('protected_date, shield_type')
    .eq('user_id', userId)
    .gte('protected_date', rangeStart)
    .lte('protected_date', rangeEnd)

  if (error) return new Map()

  const map = new Map<string, ShieldType>()
  for (const row of data ?? []) {
    map.set(row.protected_date as string, row.shield_type as ShieldType)
  }
  return map
}

// Лог использований щитов для админки
export async function getShieldLog(): Promise<ShieldLogEntry[]> {
  const supabase = createSupabaseAdminClient()

  const { data, error } = await supabase
    .from('streak_shield_log')
    .select(`
      id,
      user_id,
      shield_type,
      protected_date,
      created_at,
      notes,
      is_free,
      ws_users!streak_shield_log_user_id_fkey (
        first_name,
        last_name,
        email
      )
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return []

  return (data ?? []).map((row) => {
    const user = row.ws_users as unknown as { first_name: string; last_name: string; email: string } | null
    return {
      id: row.id,
      userId: row.user_id,
      userName: user ? `${user.first_name} ${user.last_name}`.trim() : '',
      userEmail: user?.email ?? '',
      shieldType: row.shield_type as ShieldType,
      protectedDate: row.protected_date,
      createdAt: row.created_at,
      notes: row.notes ?? null,
    }
  })
}
