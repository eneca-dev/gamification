import { createSupabaseServerClient, createSupabaseAdminClient } from '@/config/supabase'

import type {
  RevitStreak,
  AutomationLeaderboardEntry,
  RevitYesterdaySummary,
  RevitTransaction,
  DepartmentAutomationEntry,
  RevitWidgetData,
} from './types'

const STREAK_GRID_DAYS = 155
const LEADERBOARD_PERIOD_DAYS = 30

// Активные даты из elk_plugin_launches для calendar grid (звёздочки)
export async function getRevitActiveDates(email: string, days = STREAK_GRID_DAYS): Promise<string[]> {
  try {
    const supabase = await createSupabaseServerClient()
    const sinceDate = new Date()
    sinceDate.setUTCDate(sinceDate.getUTCDate() - days)
    const sinceDateStr = sinceDate.toISOString().split('T')[0]

    const { data } = await supabase
      .from('elk_plugin_launches')
      .select('work_date')
      .eq('user_email', email.toLowerCase())
      .gte('work_date', sinceDateStr)

    return [...new Set((data ?? []).map((r) => r.work_date as string))]
  } catch (error) {
    console.error('[revit] getRevitActiveDates failed:', error)
    return []
  }
}

// Стрик из revit_user_streaks через ws_users.email
export async function getRevitStreak(email: string): Promise<RevitStreak | null> {
  try {
    const supabase = await createSupabaseServerClient()
    const normalizedEmail = email.toLowerCase()

    const { data: user } = await supabase
      .from('ws_users')
      .select('id')
      .eq('email', normalizedEmail)
      .eq('is_active', true)
      .maybeSingle()

    if (!user?.id) return null

    const { data: streakRow } = await supabase
      .from('revit_user_streaks')
      .select('current_streak, best_streak, last_green_date, is_frozen')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!streakRow) return null

    return {
      current_streak: streakRow.current_streak ?? 0,
      best_streak: streakRow.best_streak ?? 0,
      last_green_date: streakRow.last_green_date ?? null,
      is_frozen: streakRow.is_frozen ?? false,
    }
  } catch (error) {
    console.error('[revit] getRevitStreak failed:', error)
    return null
  }
}

// Топ N пользователей по запускам плагинов за 30 дней
export async function getTopAutomationUsers(
  limit: number,
  currentUserEmail?: string
): Promise<AutomationLeaderboardEntry[]> {
  try {
    const supabase = await createSupabaseServerClient()
    const sinceDate = new Date()
    sinceDate.setUTCDate(sinceDate.getUTCDate() - LEADERBOARD_PERIOD_DAYS)
    const sinceDateStr = sinceDate.toISOString().split('T')[0]

    const { data: launches } = await supabase
      .from('elk_plugin_launches')
      .select('user_email, launch_count')
      .gte('work_date', sinceDateStr)

    if (!launches?.length) return []

    const totals: Record<string, number> = {}
    for (const row of launches) {
      const rowEmail = row.user_email.toLowerCase()
      totals[rowEmail] = (totals[rowEmail] ?? 0) + row.launch_count
    }

    const topEmails = Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)

    const emailList = topEmails.map(([e]) => e)
    const { data: users } = await supabase
      .from('ws_users')
      .select('email, first_name, last_name')
      .in('email', emailList)

    const emailToName: Record<string, string> = {}
    for (const u of users ?? []) {
      emailToName[u.email] = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email
    }

    const normalizedCurrentEmail = currentUserEmail?.toLowerCase()

    return topEmails.map(([topEmail, launchCount]) => ({
      email: topEmail,
      fullName: emailToName[topEmail] || topEmail,
      launchCount,
      isCurrentUser: !!normalizedCurrentEmail && topEmail === normalizedCurrentEmail,
    }))
  } catch (error) {
    console.error('[revit] getTopAutomationUsers failed:', error)
    return []
  }
}

// Сводка за вчера: сколько плагинов использовано и коинов начислено (из БД)
export async function getYesterdayRevitSummary(email: string): Promise<RevitYesterdaySummary> {
  try {
    const supabase = createSupabaseAdminClient()
    const normalizedEmail = email.toLowerCase()

    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    // Уникальные плагины за вчера
    const { data: launches } = await supabase
      .from('elk_plugin_launches')
      .select('plugin_name')
      .eq('user_email', normalizedEmail)
      .eq('work_date', yesterdayStr)

    const pluginCount = new Set((launches ?? []).map((r) => r.plugin_name)).size

    // Коины из view_user_transactions за вчера (все revit event types)
    const { data: txRows } = await supabase
      .from('view_user_transactions')
      .select('coins')
      .eq('user_email', normalizedEmail)
      .eq('event_date', yesterdayStr)
      .in('event_type', ['revit_using_plugins', 'revit_streak_7_bonus', 'revit_streak_30_bonus'])

    const coinsEarned = (txRows ?? []).reduce((sum, r) => sum + (r.coins ?? 0), 0)

    return { pluginCount, coinsEarned }
  } catch (error) {
    console.error('[revit] getYesterdayRevitSummary failed:', error)
    return { pluginCount: 0, coinsEarned: 0 }
  }
}

// Транзакции по ревиту для ленты операций
export async function getRevitTransactions(email: string, limit = 10): Promise<RevitTransaction[]> {
  try {
    const supabase = createSupabaseAdminClient()
    const normalizedEmail = email.toLowerCase()

    const { data, error } = await supabase
      .from('view_user_transactions')
      .select('event_date, event_type, coins, description, details, created_at')
      .eq('user_email', normalizedEmail)
      .eq('source', 'revit')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    return (data ?? []).map((row) => {
      const details = row.details as { plugin_name?: string; launch_count?: number } | null
      return {
        eventType: row.event_type as string,
        eventDate: row.event_date as string,
        coins: row.coins as number,
        description: row.description as string,
        pluginName: details?.plugin_name ?? null,
        launchCount: details?.launch_count ?? null,
        createdAt: row.created_at as string,
      }
    })
  } catch (error) {
    console.error('[revit] getRevitTransactions failed:', error)
    return []
  }
}

// Статистика автоматизации по отделам для соревнования (из VIEW)
export async function getDepartmentAutomationStats(
  currentUserEmail?: string
): Promise<DepartmentAutomationEntry[]> {
  try {
    const supabase = createSupabaseAdminClient()

    const { data, error } = await supabase
      .from('view_department_revit_contest')
      .select('department_code, users_earning, total_employees, total_coins')

    if (error) throw error
    if (!data?.length) return []

    let currentDeptCode: string | null = null
    if (currentUserEmail) {
      const { data: user } = await supabase
        .from('ws_users')
        .select('department_code')
        .eq('email', currentUserEmail.toLowerCase())
        .eq('is_active', true)
        .maybeSingle()

      currentDeptCode = user?.department_code ?? null
    }

    return data
      .map((row) => ({
        departmentCode: row.department_code as string,
        usersEarning: row.users_earning as number,
        totalEmployees: row.total_employees as number,
        totalCoins: row.total_coins as number,
        isCurrentDepartment: row.department_code === currentDeptCode,
      }))
      .sort((a, b) => b.totalCoins - a.totalCoins)
  } catch (error) {
    console.error('[revit] getDepartmentAutomationStats failed:', error)
    return []
  }
}

// Агрегированные данные для виджета на главной
export async function getRevitWidgetData(email: string): Promise<RevitWidgetData> {
  const [activeDates, streak, yesterdaySummary] = await Promise.all([
    getRevitActiveDates(email),
    getRevitStreak(email),
    getYesterdayRevitSummary(email),
  ])

  return { streak, activeDates, yesterdaySummary }
}
