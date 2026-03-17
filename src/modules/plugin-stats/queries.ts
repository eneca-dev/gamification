import { createSupabaseServerClient } from '@/config/supabase'

import type { AutomationStreakData, AutomationLeaderboardEntry } from './types'

const STREAK_GRID_DAYS = 98   // покрывает квартальный грид (14 недель)
const LEADERBOARD_PERIOD_DAYS = 30

export async function getUserAutomationStreak(email: string): Promise<AutomationStreakData> {
  try {
    const supabase = await createSupabaseServerClient()
    const normalizedEmail = email.toLowerCase()

    const sinceDate = new Date()
    sinceDate.setUTCDate(sinceDate.getUTCDate() - STREAK_GRID_DAYS)
    const sinceDateStr = sinceDate.toISOString().split('T')[0]

    // Резолвим email → employee_id через ws_users
    const { data: user } = await supabase
      .from('ws_users')
      .select('id')
      .eq('email', normalizedEmail)
      .eq('is_active', true)
      .maybeSingle()

    // Стрик из таблицы revit_user_streaks (вычисляется триггером fn_award_revit_points)
    let currentDays = 0
    let bestDays = 0
    let lastGreenDate: string | null = null

    if (user?.id) {
      const { data: streakRow } = await supabase
        .from('revit_user_streaks')
        .select('current_streak, best_streak, last_green_date')
        .eq('user_id', user.id)
        .maybeSingle()

      if (streakRow) {
        currentDays = streakRow.current_streak ?? 0
        bestDays = streakRow.best_streak ?? 0
        lastGreenDate = streakRow.last_green_date ?? null
      }
    }

    // Активные даты из elk_plugin_launches (для календаря)
    const { data } = await supabase
      .from('elk_plugin_launches')
      .select('work_date')
      .eq('user_email', normalizedEmail)
      .gte('work_date', sinceDateStr)

    const activeDates = [...new Set((data ?? []).map((r) => r.work_date as string))]

    return { currentDays, bestDays, lastGreenDate, activeDates }
  } catch (error) {
    console.error('[plugin-stats] getUserAutomationStreak failed:', error)
    return { currentDays: 0, bestDays: 0, lastGreenDate: null, activeDates: [] }
  }
}

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

    // Агрегируем запуски по email
    const totals: Record<string, number> = {}
    for (const row of launches) {
      const rowEmail = row.user_email.toLowerCase()
      totals[rowEmail] = (totals[rowEmail] ?? 0) + row.launch_count
    }

    // Топ N по убыванию
    const topEmails = Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)

    // Имена из ws_users
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
    console.error('[plugin-stats] getTopAutomationUsers failed:', error)
    return []
  }
}
