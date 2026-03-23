import { createSupabaseServerClient, createSupabaseAdminClient } from '@/config/supabase'

import type { EventTypeRow, AdminUserRow, UserDetail, UserTransaction } from './types'

// gamification_balances — связь 1:1, но Supabase может вернуть объект или массив
function extractCoins(balance: unknown): number {
  if (!balance) return 0
  if (Array.isArray(balance)) return (balance[0] as { total_coins: number })?.total_coins ?? 0
  return (balance as { total_coins: number }).total_coins ?? 0
}

export async function getEventTypes(): Promise<EventTypeRow[]> {
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from('gamification_event_types')
    .select('key, name, coins, description, is_active')
    .order('coins', { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getUsers(): Promise<AdminUserRow[]> {
  const supabase = createSupabaseAdminClient()

  const { data, error } = await supabase
    .from('ws_users')
    .select(`
      id, email, first_name, last_name, department, team,
      is_admin, is_active,
      gamification_balances ( total_coins )
    `)
    .eq('is_active', true)
    .order('last_name', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    first_name: row.first_name,
    last_name: row.last_name,
    department: row.department,
    team: row.team,
    is_admin: row.is_admin,
    is_active: row.is_active,
    total_coins: extractCoins(row.gamification_balances),
  }))
}

export async function getUserDetail(userId: string): Promise<UserDetail | null> {
  const supabase = createSupabaseAdminClient()

  // Пользователь + баланс
  const { data: userData, error: userError } = await supabase
    .from('ws_users')
    .select(`
      id, email, first_name, last_name, department, team,
      is_admin, is_active,
      gamification_balances ( total_coins )
    `)
    .eq('id', userId)
    .single()

  if (userError || !userData) return null

  const user: AdminUserRow = {
    id: userData.id,
    email: userData.email,
    first_name: userData.first_name,
    last_name: userData.last_name,
    department: userData.department,
    team: userData.team,
    is_admin: userData.is_admin,
    is_active: userData.is_active,
    total_coins: extractCoins(userData.gamification_balances),
  }

  // Транзакции
  const { data: txData } = await supabase
    .from('view_user_transactions')
    .select('event_date, event_type, source, coins, description, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)

  const transactions: UserTransaction[] = (txData ?? []).map((t) => ({
    event_date: t.event_date,
    event_type: t.event_type,
    source: t.source,
    coins: t.coins,
    description: t.description,
    created_at: t.created_at,
  }))

  return { user, transactions }
}
