import { cache } from 'react'

import { createSupabaseAdminClient } from '@/config/supabase'

import type { AppealCalendarDay, AppealTransaction, FeedbackRecord } from './types'

const APPEAL_WINDOW_DAYS = 90
const APPEAL_TX_WINDOW_DAYS = 30
const APPEAL_TX_LIMIT = 100

const EVENT_ICONS: Record<string, string> = {
  // Положительные
  green_day: '🟢',
  streak_daily_bonus: '🔥',
  revit_using_plugins: '⚡',
  revit_streak_7_bonus: '🔥',
  revit_streak_30_bonus: '🔥',
  ws_streak_7: '🔥',
  ws_streak_30: '🔥',
  ws_streak_90: '🔥',
  gratitude_recipient_points: '🤝',
  gratitude_gift_sent: '🎁',
  budget_ok_l3: '✅',
  budget_ok_l2: '✅',
  budget_ok_l3_lead_bonus: '✅',
  deadline_ok_l3: '⏳',
  master_planner: '🏆',
  master_planner_l2: '🏆',
  team_contest_top1_bonus: '🥇',
  ach_personal: '🏅',
  ach_team: '🏅',
  ach_department: '🏅',
  shop_refund: '🛒',
  // Отрицательные / штрафы / откаты
  red_day: '🔴',
  wrong_status_report: '⚠️',
  task_dynamics_violation: '⏰',
  section_red: '📋',
  streak_reset_timetracking: '💔',
  streak_reset_dynamics: '💔',
  streak_reset_section: '💔',
  streak_reset_wrong_status: '💔',
  budget_exceeded_l2: '⚠️',
  budget_exceeded_l3: '⚠️',
  budget_revoked_l2: '↩️',
  budget_revoked_l3: '↩️',
  budget_revoked_l3_lead: '↩️',
  deadline_revoked_l3: '↩️',
  master_planner_reset: '💔',
  master_planner_l2_reset: '💔',
  master_planner_revoked: '↩️',
  master_planner_l2_revoked: '↩️',
  shop_purchase: '🛒',
}

function iconFor(eventType: string): string {
  return EVENT_ICONS[eventType] ?? '💎'
}

function describeTx(eventType: string, source: string, raw: string | null): string {
  if (raw && raw.trim().length > 0) return raw.trim()
  const labels: Record<string, string> = {
    // Положительные
    green_day: 'Зелёный день',
    streak_daily_bonus: 'Ежедневный бонус стрика',
    revit_using_plugins: 'Использование Revit-плагинов',
    revit_streak_7_bonus: 'Бонус за стрик 7 дней (Revit)',
    revit_streak_30_bonus: 'Бонус за стрик 30 дней (Revit)',
    ws_streak_7: 'Бонус за стрик 7 дней (Worksection)',
    ws_streak_30: 'Бонус за стрик 30 дней (Worksection)',
    ws_streak_90: 'Бонус за стрик 90 дней (Worksection)',
    gratitude_recipient_points: 'Полученная благодарность',
    gratitude_gift_sent: 'Отправленный подарок',
    budget_ok_l3: 'Бонус за бюджет (L3)',
    budget_ok_l2: 'Бонус за бюджет (L2)',
    budget_ok_l3_lead_bonus: 'Лид-бонус за бюджет',
    deadline_ok_l3: 'Бонус за дедлайн',
    master_planner: 'Бонус master planner',
    master_planner_l2: 'Бонус master planner (L2)',
    team_contest_top1_bonus: 'Победа в соревновании команд',
    ach_personal: 'Личное достижение',
    ach_team: 'Командное достижение',
    ach_department: 'Достижение отдела',
    shop_refund: 'Возврат из магазина',
    // Отрицательные
    red_day: 'Красный день',
    wrong_status_report: 'Отчёт без статуса «В работе»',
    task_dynamics_violation: 'Нарушена динамика задачи',
    section_red: 'Не сменена метка готовности',
    streak_reset_timetracking: 'Сброс стрика (учёт времени)',
    streak_reset_dynamics: 'Сброс стрика (динамика)',
    streak_reset_section: 'Сброс стрика (разделы)',
    streak_reset_wrong_status: 'Сброс стрика (неверный статус)',
    budget_exceeded_l2: 'Превышен бюджет (L2)',
    budget_exceeded_l3: 'Превышен бюджет (L3)',
    budget_revoked_l2: 'Отозван бонус за бюджет (L2)',
    budget_revoked_l3: 'Отозван бонус за бюджет (L3)',
    budget_revoked_l3_lead: 'Отозван лид-бонус за бюджет',
    deadline_revoked_l3: 'Отозван бонус за дедлайн',
    master_planner_reset: 'Сброс master planner',
    master_planner_l2_reset: 'Сброс master planner (L2)',
    master_planner_revoked: 'Отозван бонус master planner',
    master_planner_l2_revoked: 'Отозван бонус master planner (L2)',
    shop_purchase: 'Покупка в магазине',
  }
  return labels[eventType] ?? eventType
}

export const getFeedbackList = cache(async function getFeedbackList(): Promise<
  FeedbackRecord[]
> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('feedback')
    .select('*')
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data as FeedbackRecord[]
})

export const getAppealsList = cache(async function getAppealsList(): Promise<
  FeedbackRecord[]
> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('feedback')
    .select('*')
    .eq('type', 'appeal')
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data as FeedbackRecord[]
})

function addDaysIso(iso: string, delta: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

export const getAppealCalendar = cache(async function getAppealCalendar(
  wsUserId: string
): Promise<AppealCalendarDay[]> {
  const supabase = createSupabaseAdminClient()
  const { data: todayRow } = await supabase.rpc('fn_minsk_today')
  const today = (todayRow as string | null) ?? new Date().toISOString().slice(0, 10)
  // Расширяем окно до 1-го числа месяца, которому принадлежит (today - APPEAL_WINDOW_DAYS):
  // так грид всегда показывает полные месяцы, как StreakPanel на главной.
  const rawFrom = addDaysIso(today, -APPEAL_WINDOW_DAYS)
  const fromDay = rawFrom.slice(0, 8) + '01'

  const [statusesRes, txsRes] = await Promise.all([
    supabase
      .from('ws_daily_statuses')
      .select('date, status, absence_type')
      .eq('user_id', wsUserId)
      .gte('date', fromDay)
      .lte('date', today)
      .order('date', { ascending: true }),
    // event_date у ws-событий сдвинут +1 — захватываем диапазон с +1 с обеих сторон
    supabase
      .from('gamification_transactions')
      .select('event_date, coins')
      .eq('user_id', wsUserId)
      .gte('event_date', fromDay)
      .lte('event_date', addDaysIso(today, 1))
      .lt('coins', 0),
  ])

  const negByWorkDay = new Map<string, number>()
  for (const tx of txsRes.data ?? []) {
    const eventDate = tx.event_date as string
    const coins = tx.coins as number
    // Для ws-событий работаем в терминах рабочего дня (event_date - 1).
    // Пользователь выбирает рабочий день, в котором произошло списание.
    const workDay = addDaysIso(eventDate, -1)
    const current = (negByWorkDay.get(eventDate) ?? 0) + (negByWorkDay.get(workDay) ?? 0)
    // Пишем сумму по обоим — финальный клиент решит по дате
    void current
    negByWorkDay.set(workDay, (negByWorkDay.get(workDay) ?? 0) + coins)
  }

  const byDate = new Map<string, AppealCalendarDay>()
  for (const row of statusesRes.data ?? []) {
    const date = row.date as string
    const status = row.status as 'green' | 'red' | 'absent'
    byDate.set(date, {
      date,
      status,
      absence_type: (row.absence_type as string | null) ?? null,
      negative_coins: negByWorkDay.get(date) ?? 0,
    })
  }

  // Все дни окна (включая те, где статуса нет — например, выходные)
  const result: AppealCalendarDay[] = []
  let cursor = fromDay
  while (cursor <= today) {
    const existing = byDate.get(cursor)
    if (existing) {
      result.push(existing)
    } else {
      result.push({
        date: cursor,
        status: 'none',
        absence_type: null,
        negative_coins: negByWorkDay.get(cursor) ?? 0,
      })
    }
    cursor = addDaysIso(cursor, 1)
  }

  return result
})

export const getAppealTransactions = cache(async function getAppealTransactions(
  wsUserId: string
): Promise<AppealTransaction[]> {
  const supabase = createSupabaseAdminClient()
  const { data: todayRow } = await supabase.rpc('fn_minsk_today')
  const today = (todayRow as string | null) ?? new Date().toISOString().slice(0, 10)
  const from = addDaysIso(today, -APPEAL_TX_WINDOW_DAYS)

  const { data, error } = await supabase
    .from('view_user_transactions')
    .select('transaction_id, event_date, event_type, source, coins, description')
    .eq('user_id', wsUserId)
    .gte('event_date', from)
    .order('event_date', { ascending: false })
    .order('transaction_id', { ascending: false })
    .limit(APPEAL_TX_LIMIT)

  if (error || !data) return []

  return data.map((row): AppealTransaction => {
    const eventType = row.event_type as string
    const source = row.source as string
    return {
      id: row.transaction_id as string,
      event_date: row.event_date as string,
      event_type: eventType,
      source,
      coins: row.coins as number,
      description: describeTx(eventType, source, (row.description as string | null) ?? null),
      icon: iconFor(eventType),
    }
  })
})

export const getUserAppeals = cache(async function getUserAppeals(
  wsUserId: string
): Promise<FeedbackRecord[]> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('feedback')
    .select('*')
    .eq('type', 'appeal')
    .eq('ws_user_id', wsUserId)
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data as FeedbackRecord[]
})
