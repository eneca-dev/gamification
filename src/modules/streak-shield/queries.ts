import { createSupabaseServerClient, createSupabaseAdminClient } from '@/config/supabase'

import type { PendingReset, ShieldLogEntry, ShieldType } from './types'

// Получить pending resets для текущего пользователя (для UI)
export async function getPendingResets(userId: string): Promise<PendingReset[]> {
  const supabase = await createSupabaseServerClient()
  const result: PendingReset[] = []

  // WS pending
  const now = new Date().toISOString()

  const { data: wsStreak } = await supabase
    .from('ws_user_streaks')
    .select('pending_reset_date, pending_reset_expires_at, current_streak')
    .eq('user_id', userId)
    .not('pending_reset_date', 'is', null)
    .gt('pending_reset_expires_at', now)
    .maybeSingle()

  // Revit pending
  const { data: revitStreak } = await supabase
    .from('revit_user_streaks')
    .select('pending_reset_date, pending_reset_expires_at, current_streak')
    .eq('user_id', userId)
    .not('pending_reset_date', 'is', null)
    .gt('pending_reset_expires_at', now)
    .maybeSingle()

  // Товары-щиты (цена + id)
  const { data: shieldProducts } = await supabase
    .from('shop_products')
    .select('id, price, effect')
    .in('effect', ['streak_shield_ws', 'streak_shield_revit'])
    .eq('is_active', true)

  const productMap = new Map<string, { id: string; price: number }>()
  for (const p of shieldProducts ?? []) {
    productMap.set(p.effect as string, { id: p.id, price: p.price })
  }

  if (wsStreak) {
    const product = productMap.get('streak_shield_ws')
    if (product) {
      result.push({
        type: 'ws',
        pendingResetDate: wsStreak.pending_reset_date,
        expiresAt: wsStreak.pending_reset_expires_at,
        currentStreak: wsStreak.current_streak ?? 0,
        price: product.price,
        productId: product.id,
      })
    }
  }

  if (revitStreak) {
    const product = productMap.get('streak_shield_revit')
    if (product) {
      result.push({
        type: 'revit',
        pendingResetDate: revitStreak.pending_reset_date,
        expiresAt: revitStreak.pending_reset_expires_at,
        currentStreak: revitStreak.current_streak ?? 0,
        price: product.price,
        productId: product.id,
      })
    }
  }

  return result
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
