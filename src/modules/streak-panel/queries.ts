import { createSupabaseAdminClient } from '@/config/supabase'
import { cached, CACHE_5M } from '@/lib/server-cache'

import type { DayStatusRow, StreakMilestone, WsStreakData, RevitStreakData } from './types'

// --- Внутренние функции (без кэша) ---

async function _getStreakDayStatuses(userId: string, gridStart: string, gridEnd: string): Promise<DayStatusRow[]> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('ws_daily_statuses')
    .select('date, status, absence_type, red_reasons')
    .eq('user_id', userId)
    .gte('date', gridStart)
    .lte('date', gridEnd)

  if (error) { console.error('[streak-panel] getStreakDayStatuses failed:', error); return [] }
  return (data ?? []) as DayStatusRow[]
}

async function _getHolidayDates(gridStart: string, gridEnd: string): Promise<string[]> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('calendar_holidays')
    .select('date')
    .gte('date', gridStart)
    .lte('date', gridEnd)

  if (error) { console.error('[streak-panel] getHolidays failed:', error); return [] }
  return (data ?? []).map((r) => r.date as string)
}

async function _getWorkdayDates(gridStart: string, gridEnd: string): Promise<string[]> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('calendar_workdays')
    .select('date')
    .gte('date', gridStart)
    .lte('date', gridEnd)

  if (error) { console.error('[streak-panel] getWorkdays failed:', error); return [] }
  return (data ?? []).map((r) => r.date as string)
}

async function _getAutomationDayDates(userEmail: string, gridStart: string, gridEnd: string): Promise<string[]> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('elk_plugin_launches')
    .select('work_date')
    .eq('user_email', userEmail.toLowerCase())
    .gte('work_date', gridStart)
    .lte('work_date', gridEnd)

  if (error) { console.error('[streak-panel] getAutomationDays failed:', error); return [] }
  return [...new Set((data ?? []).map((r) => r.work_date as string))]
}

async function _getWsStreakData(userId: string): Promise<WsStreakData> {
  const supabase = createSupabaseAdminClient()

  const { data: streakRow } = await supabase
    .from('ws_user_streaks')
    .select('current_streak, longest_streak, streak_start_date, completed_cycles')
    .eq('user_id', userId)
    .maybeSingle()

  const currentStreak = streakRow?.current_streak ?? 0
  const longestStreak = streakRow?.longest_streak ?? 0
  const streakStartDate = streakRow?.streak_start_date ?? null
  const completedCycles = streakRow?.completed_cycles ?? 0

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

async function _getRevitStreakData(userId: string): Promise<RevitStreakData> {
  const supabase = createSupabaseAdminClient()

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

// --- Публичные функции с кэшем (1 час) ---

export const getStreakDayStatuses = (userId: string, gridStart: string, gridEnd: string) =>
  cached(_getStreakDayStatuses, ['day-statuses', userId, gridStart, gridEnd], {
    tags: [`day-statuses:${userId}`], revalidate: CACHE_5M,
  })(userId, gridStart, gridEnd)

export async function getHolidays(gridStart: string, gridEnd: string): Promise<Set<string>> {
  const dates = await cached(_getHolidayDates, ['holidays', gridStart, gridEnd], {
    tags: ['calendar'], revalidate: CACHE_5M,
  })(gridStart, gridEnd)
  return new Set(dates)
}

export async function getWorkdays(gridStart: string, gridEnd: string): Promise<Set<string>> {
  const dates = await cached(_getWorkdayDates, ['workdays', gridStart, gridEnd], {
    tags: ['calendar'], revalidate: CACHE_5M,
  })(gridStart, gridEnd)
  return new Set(dates)
}

export async function getAutomationDays(userEmail: string, gridStart: string, gridEnd: string): Promise<Set<string>> {
  const dates = await cached(_getAutomationDayDates, ['automation-days', userEmail, gridStart, gridEnd], {
    tags: [`automation:${userEmail}`], revalidate: CACHE_5M,
  })(userEmail, gridStart, gridEnd)
  return new Set(dates)
}

export const getWsStreakData = (userId: string) =>
  cached(_getWsStreakData, ['ws-streak', userId], {
    tags: [`streak-ws:${userId}`], revalidate: CACHE_5M,
  })(userId)

export const getRevitStreakData = (userId: string) =>
  cached(_getRevitStreakData, ['revit-streak', userId], {
    tags: [`streak-revit:${userId}`], revalidate: CACHE_5M,
  })(userId)
