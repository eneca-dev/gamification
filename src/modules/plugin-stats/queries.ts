import { createSupabaseServerClient, createSupabaseAdminClient } from '@/config/supabase'

import type { AutomationStreakData, AutomationLeaderboardEntry } from './types'

const STREAK_GRID_DAYS = 98   // покрывает квартальный грид (14 недель)
const LEADERBOARD_PERIOD_DAYS = 30

// Считает серию последовательных рабочих дней (пн–пт) с запусками плагинов,
// идя назад от вчерашнего дня. Выходные пропускаются и не прерывают серию.
function computeStreak(activeDatesSet: Set<string>): number {
  let count = 0
  const d = new Date()
  d.setUTCHours(12, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - 1) // начинаем со вчера (сегодняшние данные ещё не синхронизированы)

  for (let i = 0; i < 90; i++) {
    const dow = d.getUTCDay()
    if (dow !== 0 && dow !== 6) {
      const dateStr = d.toISOString().split('T')[0]
      if (!activeDatesSet.has(dateStr)) break
      count++
    }
    d.setUTCDate(d.getUTCDate() - 1)
  }

  return count
}

export async function getUserAutomationStreak(email: string): Promise<AutomationStreakData> {
  try {
    const supabase = await createSupabaseServerClient()

    const sinceDate = new Date()
    sinceDate.setUTCDate(sinceDate.getUTCDate() - STREAK_GRID_DAYS)
    const sinceDateStr = sinceDate.toISOString().split('T')[0]

    const { data } = await supabase
      .from('elk_plugin_launches')
      .select('work_date')
      .eq('user_email', email.toLowerCase())
      .gte('work_date', sinceDateStr)

    const activeDates = (data ?? []).map((r) => r.work_date as string)
    const activeDatesSet = new Set(activeDates)

    return {
      currentDays: computeStreak(activeDatesSet),
      activeDates,
    }
  } catch (error) {
    console.error('[plugin-stats] getUserAutomationStreak failed:', error)
    return { currentDays: 0, activeDates: [] }
  }
}

export async function getTopAutomationUsers(
  limit: number,
  currentUserEmail?: string
): Promise<AutomationLeaderboardEntry[]> {
  try {
    const adminClient = createSupabaseAdminClient()

    const sinceDate = new Date()
    sinceDate.setUTCDate(sinceDate.getUTCDate() - LEADERBOARD_PERIOD_DAYS)
    const sinceDateStr = sinceDate.toISOString().split('T')[0]

    const { data: launches } = await adminClient
      .from('elk_plugin_launches')
      .select('user_email, launch_count')
      .gte('work_date', sinceDateStr)

    if (!launches?.length) return []

    // Агрегируем запуски по email (нормализуем к нижнему регистру для консистентности)
    const totals: Record<string, number> = {}
    for (const row of launches) {
      const email = row.user_email.toLowerCase()
      totals[email] = (totals[email] ?? 0) + row.launch_count
    }

    // Топ N по убыванию
    const topEmails = Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)

    // Имена пользователей из auth
    const { data: authData } = await adminClient.auth.admin.listUsers({ perPage: 500 })
    const emailToName: Record<string, string> = {}
    for (const u of authData?.users ?? []) {
      if (u.email) {
        emailToName[u.email.toLowerCase()] = u.user_metadata?.full_name || u.email
      }
    }

    const normalizedCurrentEmail = currentUserEmail?.toLowerCase()

    return topEmails.map(([email, launchCount]) => ({
      email,
      fullName: emailToName[email] || email,
      launchCount,
      isCurrentUser: !!normalizedCurrentEmail && email === normalizedCurrentEmail,
    }))
  } catch (error) {
    console.error('[plugin-stats] getTopAutomationUsers failed:', error)
    return []
  }
}
