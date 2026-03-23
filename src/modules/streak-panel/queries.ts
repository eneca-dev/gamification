import { createSupabaseServerClient } from '@/config/supabase'

import type { DayStatusRow, StreakMilestone, WsStreakData, RevitStreakData } from './types'

// Статусы дней из ws_daily_statuses за период
export async function getStreakDayStatuses(
  userId: string,
  gridStart: string,
  gridEnd: string,
): Promise<DayStatusRow[]> {
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from('ws_daily_statuses')
    .select('date, status, absence_type, red_reasons')
    .eq('user_id', userId)
    .gte('date', gridStart)
    .lte('date', gridEnd)

  if (error) {
    console.error('[streak-panel] getStreakDayStatuses failed:', error)
    return []
  }

  return (data ?? []) as DayStatusRow[]
}

// Даты с автоматизацией из elk_plugin_launches
export async function getAutomationDays(
  userEmail: string,
  gridStart: string,
  gridEnd: string,
): Promise<Set<string>> {
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from('elk_plugin_launches')
    .select('work_date')
    .eq('user_email', userEmail.toLowerCase())
    .gte('work_date', gridStart)
    .lte('work_date', gridEnd)

  if (error) {
    console.error('[streak-panel] getAutomationDays failed:', error)
    return new Set()
  }

  return new Set((data ?? []).map((r) => r.work_date as string))
}

// Данные стрика WS + milestones
export async function getWsStreakData(userId: string): Promise<WsStreakData> {
  const supabase = await createSupabaseServerClient()

  const { data: streakRow } = await supabase
    .from('ws_user_streaks')
    .select('current_streak, longest_streak, streak_start_date, completed_cycles')
    .eq('user_id', userId)
    .maybeSingle()

  const currentStreak = streakRow?.current_streak ?? 0
  const longestStreak = streakRow?.longest_streak ?? 0
  const streakStartDate = streakRow?.streak_start_date ?? null
  const completedCycles = streakRow?.completed_cycles ?? 0

  // Milestones из gamification_event_types
  const { data: eventTypes } = await supabase
    .from('gamification_event_types')
    .select('key, coins')
    .in('key', ['ws_streak_7', 'ws_streak_30', 'ws_streak_90'])

  const coinsMap = new Map<string, number>()
  for (const et of eventTypes ?? []) coinsMap.set(et.key, et.coins)

  const milestones: StreakMilestone[] = [
    { days: 7, reward: coinsMap.get('ws_streak_7') ?? 25, reached: currentStreak >= 7 },
    { days: 30, reward: coinsMap.get('ws_streak_30') ?? 100, reached: currentStreak >= 30 },
    { days: 90, reward: coinsMap.get('ws_streak_90') ?? 300, reached: currentStreak >= 90 },
  ]

  return { currentStreak, longestStreak, streakStartDate, completedCycles, milestones }
}

// Данные стрика Revit + milestones
export async function getRevitStreakData(userId: string): Promise<RevitStreakData> {
  const supabase = await createSupabaseServerClient()

  const { data: streakRow } = await supabase
    .from('revit_user_streaks')
    .select('current_streak')
    .eq('user_id', userId)
    .maybeSingle()

  const currentStreak = streakRow?.current_streak ?? 0

  const { data: eventTypes } = await supabase
    .from('gamification_event_types')
    .select('key, coins')
    .in('key', ['revit_streak_7_bonus', 'revit_streak_30_bonus'])

  const coinsMap = new Map<string, number>()
  for (const et of eventTypes ?? []) coinsMap.set(et.key, et.coins)

  const milestones: StreakMilestone[] = [
    { days: 7, reward: coinsMap.get('revit_streak_7_bonus') ?? 25, reached: currentStreak >= 7 },
    { days: 30, reward: coinsMap.get('revit_streak_30_bonus') ?? 100, reached: currentStreak >= 30 },
  ]

  return { currentStreak, milestones }
}
