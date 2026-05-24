import { createSupabaseAdminClient } from '@/config/supabase'
import { cached, CACHE_5M } from '@/lib/server-cache'

import type { DayStatusRow, StreakMilestone, WsStreakData, RevitStreakData, CalendarDay, CalendarDayStatus, RedReason } from './types'

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function getGridRange(): { rangeStart: string; rangeEnd: string } {
  const now = new Date()
  const startMonth = Math.floor(now.getMonth() / 2) * 2
  const rangeStart = new Date(now.getFullYear(), startMonth - 1, 1)
  const rangeEnd = new Date(now.getFullYear(), startMonth + 3, 0)
  return { rangeStart: toIsoDate(rangeStart), rangeEnd: toIsoDate(rangeEnd) }
}

export function buildCalendarDays(
  rangeStart: string,
  rangeEnd: string,
  statusMap: Map<string, { status: string; absence_type: string | null; red_reasons: RedReason[] | null }>,
  automationDates: Set<string>,
  holidays: Set<string>,
  workdays: Set<string>,
): CalendarDay[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const days: CalendarDay[] = []
  const start = new Date(rangeStart + 'T00:00:00')
  const end = new Date(rangeEnd + 'T00:00:00')

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = toIsoDate(d)
    const dow = d.getDay()
    const isWeekend = dow === 0 || dow === 6

    const isDayOff = (isWeekend && !workdays.has(dateStr)) || (!isWeekend && holidays.has(dateStr))
    if (isDayOff) {
      days.push({ date: dateStr, status: 'gray', automation: false })
      continue
    }

    const isFuture = d > today
    if (isFuture) {
      days.push({ date: dateStr, status: 'future', automation: false })
      continue
    }

    const row = statusMap.get(dateStr)
    if (!row) {
      days.push({ date: dateStr, status: 'no_data', automation: automationDates.has(dateStr) })
      continue
    }

    let uiStatus: CalendarDayStatus
    let absenceType: string | null = null
    let redReasons: RedReason[] | null = null

    if (row.status === 'green') {
      uiStatus = 'green'
    } else if (row.status === 'red') {
      uiStatus = 'red'
      redReasons = row.red_reasons
    } else if (row.status === 'absent') {
      uiStatus = 'frozen'
      absenceType = row.absence_type
    } else {
      uiStatus = 'no_data'
    }

    days.push({
      date: dateStr,
      status: uiStatus,
      automation: automationDates.has(dateStr) && uiStatus !== 'frozen',
      absenceType,
      redReasons,
    })
  }

  return days
}

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
    .from('ws_user_streaks_effective')
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
    .from('revit_user_streaks_effective')
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
