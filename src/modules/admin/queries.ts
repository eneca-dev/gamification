import { createSupabaseServerClient, createSupabaseAdminClient } from '@/config/supabase'

import type {
  EventTypeRow, AdminUserRow, UserDetail, UserTransaction, AdminOrderRow,
  RankingSettingRow, GratitudeSettingRow,
  CalendarHolidayRow, CalendarWorkdayRow,
  EconomyFilters, EconomyOverview, TopSource, TopLevel, TopRow, CategoryRow,
  EconomyPeriodPreset, DepartmentGroupRow, LowBalanceUser,
} from './types'

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

export async function getRankingSettings(): Promise<RankingSettingRow[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('ach_ranking_settings')
    .select('area, entity_type, threshold, is_active')
    .order('area')
    .order('entity_type')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getGratitudeSettings(): Promise<GratitudeSettingRow[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('ach_gratitude_settings')
    .select('category, achievement_name, threshold, bonus_coins, is_active')
    .order('category')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getUsers(): Promise<AdminUserRow[]> {
  const supabase = createSupabaseAdminClient()

  const { data, error } = await supabase
    .from('ws_users')
    .select(`
      id, email, first_name, last_name, department, team,
      is_admin, is_beta_tester, is_active,
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
    is_beta_tester: row.is_beta_tester,
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
      is_admin, is_beta_tester, is_active,
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
    is_beta_tester: userData.is_beta_tester,
    is_active: userData.is_active,
    total_coins: extractCoins(userData.gamification_balances),
  }

  // Транзакции
  const { data: txData } = await supabase
    .from('view_user_transactions')
    .select('event_date, event_type, source, coins, description, details, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)

  const transactions: UserTransaction[] = (txData ?? []).map((t) => ({
    event_date: t.event_date,
    event_type: t.event_type,
    source: t.source,
    coins: t.coins,
    description: t.description,
    details: (t.details as Record<string, unknown>) ?? null,
    created_at: t.created_at,
  }))

  return { user, transactions }
}

export async function getOrders(): Promise<AdminOrderRow[]> {
  const supabase = createSupabaseAdminClient()

  const { data, error } = await supabase
    .from('shop_orders')
    .select(`
      *,
      user:ws_users!user_id ( first_name, last_name, email ),
      product:shop_products!product_id ( name, emoji, image_url, category:shop_categories!category_id ( is_physical ) ),
      transaction:gamification_transactions!transaction_id ( coins )
    `)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    const user = Array.isArray(row.user) ? row.user[0] : row.user
    const product = Array.isArray(row.product) ? row.product[0] : row.product
    const transaction = Array.isArray(row.transaction) ? row.transaction[0] : row.transaction
    return {
      id: row.id,
      user_id: row.user_id,
      user_name: `${user?.last_name ?? ''} ${user?.first_name ?? ''}`.trim() || 'Неизвестный',
      user_email: user?.email ?? '',
      product_id: row.product_id,
      product_name: product?.name ?? 'Удалённый товар',
      product_emoji: product?.emoji ?? null,
      product_image_url: product?.image_url ?? null,
      is_physical: (() => {
        const cat = Array.isArray(product?.category) ? product.category[0] : product?.category
        return cat?.is_physical ?? true
      })(),
      status: row.status,
      coins_spent: Math.abs(transaction?.coins ?? 0),
      note: row.note,
      status_changed_by: row.status_changed_by,
      status_changed_at: row.status_changed_at,
      created_at: row.created_at,
    }
  })
}

export async function getCalendarHolidays(): Promise<CalendarHolidayRow[]> {
  const supabase = createSupabaseAdminClient()

  const { data, error } = await supabase
    .from('calendar_holidays')
    .select('id, date, name, created_at')
    .order('date', { ascending: true })

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getCalendarWorkdays(): Promise<CalendarWorkdayRow[]> {
  const supabase = createSupabaseAdminClient()

  const { data, error } = await supabase
    .from('calendar_workdays')
    .select('id, date, name, created_at')
    .order('date', { ascending: true })

  if (error) throw new Error(error.message)
  return data ?? []
}

// --- Economy Dashboard ---

export async function getEconomyOverview(filters: EconomyFilters): Promise<EconomyOverview> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc('get_economy_overview', {
    p_from: filters.from,
    p_to: filters.to,
    p_beta_only: filters.betaOnly,
  })
  if (error) throw new Error(error.message)
  return data as EconomyOverview
}

export async function getEconomyTop(
  filters: EconomyFilters,
  source: TopSource,
  level: TopLevel,
): Promise<TopRow[]> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc('get_economy_top', {
    p_from: filters.from,
    p_to: filters.to,
    p_beta_only: filters.betaOnly,
    p_source: source,
    p_level: level,
  })
  if (error) throw new Error(error.message)

  type RawRow = { id: string; name: string | null; value: number; secondary: number | null }
  return ((data ?? []) as RawRow[]).map((r) => ({
    id: r.id,
    name: r.name ?? 'Без имени',
    value: r.value,
    secondary: r.secondary,
  }))
}

export async function getEconomyCategoryBreakdown(
  filters: EconomyFilters,
): Promise<CategoryRow[]> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc('get_economy_category_breakdown', {
    p_from: filters.from,
    p_to: filters.to,
    p_beta_only: filters.betaOnly,
  })
  if (error) throw new Error(error.message)
  return (data ?? []) as CategoryRow[]
}

export async function getDepartmentGroups(): Promise<DepartmentGroupRow[]> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('admin_department_groups')
    .select('department, group_type')
  if (error) throw new Error(error.message)
  return (data ?? []) as DepartmentGroupRow[]
}

export async function getAllDepartments(): Promise<string[]> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('ws_users')
    .select('department')
    .eq('is_active', true)
    .not('department', 'is', null)
  if (error) throw new Error(error.message)
  const all = (data ?? []).map((u) => u.department as string)
  return [...new Set(all)].sort()
}

export async function getUsersSortedByBalance(betaOnly: boolean): Promise<LowBalanceUser[]> {
  const supabase = createSupabaseAdminClient()

  let query = supabase
    .from('ws_users')
    .select('id, first_name, last_name, email, department, team, is_beta_tester, gamification_balances(total_coins)')
    .eq('is_active', true)
    .not('team', 'eq', 'Декретный')

  if (betaOnly) query = query.eq('is_beta_tester', true)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const users = (data ?? []).map((row) => ({
    id: row.id,
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    department: row.department as string | null,
    team: row.team as string | null,
    is_beta_tester: row.is_beta_tester,
    total_coins: extractCoins(row.gamification_balances),
    group_type: null as 'designer' | 'non_designer' | null,
  }))

  users.sort((a, b) => a.total_coins - b.total_coins)
  return users
}

// YYYY-MM-DD → ISO начало дня (UTC). Возвращает null для невалидной даты
export function dayToIsoStart(day: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  return new Date(`${day}T00:00:00Z`).toISOString()
}

// YYYY-MM-DD → ISO конец дня (= начало следующего, для строгого `< p_to`)
export function dayToIsoEnd(day: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString()
}

// Резолвер пресетов периода → ISO-границы для RPC. 'all' возвращает null/null.
// Для 'custom' принимает YYYY-MM-DD и конвертирует в ISO начало/конец дня
export function resolveEconomyPeriod(
  preset: EconomyPeriodPreset,
  customFrom?: string | null,
  customTo?: string | null,
): { from: string | null; to: string | null } {
  if (preset === 'all') return { from: null, to: null }
  if (preset === 'custom') {
    return {
      from: customFrom ? dayToIsoStart(customFrom) : null,
      to: customTo ? dayToIsoEnd(customTo) : null,
    }
  }

  const now = new Date()
  const from = new Date(now)
  if (preset === '7d') from.setDate(from.getDate() - 7)
  else if (preset === '30d') from.setDate(from.getDate() - 30)
  else if (preset === '90d') from.setDate(from.getDate() - 90)
  else if (preset === 'year') from.setFullYear(from.getFullYear() - 1)

  return { from: from.toISOString(), to: now.toISOString() }
}

// Лёгкий список пользователей (для поиска в админке)
export async function getUsersLight(): Promise<{ id: string; name: string; department: string | null }[]> {
  const supabase = createSupabaseAdminClient()

  const { data, error } = await supabase
    .from('ws_users')
    .select('id, first_name, last_name, department_code')
    .eq('is_active', true)
    .not('team', 'eq', 'Декретный')
    .order('last_name')

  if (error) {
    console.error('getUsersLight:', error.message)
    return []
  }

  return (data ?? []).map((u) => ({
    id: u.id,
    name: `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim(),
    department: u.department_code,
  }))
}
