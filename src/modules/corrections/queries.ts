import 'server-only'

import { createSupabaseAdminClient } from '@/config/supabase'

import type {
  AdminCorrectionRow,
  AvailableEventType,
  CorrectionCalendarDay,
  CorrectionTransaction,
  CorrectionUserAppeal,
  CorrectionUserDetail,
  CorrectionUserRow,
} from './types'

// Белый список типов для ручного создания — зеркало fn_correction_is_addable_event.
const ADDABLE_EVENT_TYPES: ReadonlySet<string> = new Set([
  'red_day','green_day','wrong_status_report','task_dynamics_violation','section_red',
  'master_planner','master_planner_l2',
  'master_planner_revoked','master_planner_l2_revoked',
  'master_planner_reset','master_planner_l2_reset',
  'budget_ok_l2','budget_ok_l3','budget_ok_l3_lead_bonus',
  'budget_revoked_l2','budget_revoked_l3','budget_revoked_l3_lead',
  'budget_exceeded_l2','budget_exceeded_l3',
  'deadline_ok_l3','deadline_revoked_l3',
  'team_contest_top1_bonus','ws_team_contest_top1_bonus',
  'ws_dept_contest_top1_bonus','revit_team_contest_top1_bonus',
  'revit_using_plugins','streak_shield_used','balance_correction',
])

function sourceForEventType(key: string): AvailableEventType['source'] {
  if (key === 'revit_using_plugins' || key === 'revit_team_contest_top1_bonus') return 'revit'
  if (key.includes('contest_top1_bonus')) return 'contest'
  if (key === 'balance_correction') return 'admin'
  return 'ws'
}

// ============================================================
// Хелперы
// ============================================================

/** Форматирует email в полное имя пользователя. */
function fullName(row: { first_name: string | null; last_name: string | null; email: string }): string {
  return `${row.last_name ?? ''} ${row.first_name ?? ''}`.trim() || row.email
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

/** Текущая дата по Минску — не через new Date() + toISOString(), иначе ночью сдвинется. */
async function getMinskToday(supabase: ReturnType<typeof createSupabaseAdminClient>): Promise<string> {
  const { data, error } = await supabase.rpc('fn_minsk_today')
  if (error || !data) throw new Error(error?.message ?? 'fn_minsk_today returned null')
  return data as string
}

function addDaysIso(iso: string, delta: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

// ============================================================
// Список пользователей для админки корректировок
// ============================================================

export async function getCorrectionUsers(): Promise<CorrectionUserRow[]> {
  const supabase = createSupabaseAdminClient()

  const { data, error } = await supabase
    .from('view_correction_users')
    .select('*')
    .order('last_name', { ascending: true, nullsFirst: false })
    .range(0, 4999)

  if (error) throw new Error(error.message)

  return (data ?? []).map((u): CorrectionUserRow => ({
    id: u.id as string,
    email: u.email as string,
    first_name: (u.first_name as string | null) ?? null,
    last_name: (u.last_name as string | null) ?? null,
    name: fullName({
      first_name: (u.first_name as string | null) ?? null,
      last_name: (u.last_name as string | null) ?? null,
      email: u.email as string,
    }),
    department: (u.department as string | null) ?? null,
    team: (u.team as string | null) ?? null,
    is_admin: Boolean(u.is_admin),
    is_active: Boolean(u.is_active),
    total_coins: (u.total_coins as number | null) ?? 0,
    ws_streak: (u.ws_streak as number | null) ?? null,
    revit_streak: (u.revit_streak as number | null) ?? null,
    rank_ws: (u.rank_ws as number | null) ?? null,
    rank_revit: (u.rank_revit as number | null) ?? null,
    balance_mismatch: Boolean(u.balance_mismatch),
  }))
}

// ============================================================
// Детальная карточка пользователя для корректировки
// ============================================================

// Календарь показывает всю историю с запуска геймификации (01.07.2026) до
// сегодняшнего дня включительно. 105–130 дней на пользователя — дёшево и
// позволяет HR листать на любой прошедший месяц.
const CALENDAR_START = '2026-07-01'

export async function getCorrectionUserDetail(userId: string): Promise<CorrectionUserDetail | null> {
  const supabase = createSupabaseAdminClient()

  const { data: userRow, error: userErr } = await supabase
    .from('view_correction_users')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (userErr) throw new Error(userErr.message)
  if (!userRow) return null

  const user: CorrectionUserRow = {
    id: userRow.id as string,
    email: userRow.email as string,
    first_name: (userRow.first_name as string | null) ?? null,
    last_name: (userRow.last_name as string | null) ?? null,
    name: fullName({
      first_name: (userRow.first_name as string | null) ?? null,
      last_name: (userRow.last_name as string | null) ?? null,
      email: userRow.email as string,
    }),
    department: (userRow.department as string | null) ?? null,
    team: (userRow.team as string | null) ?? null,
    is_admin: Boolean(userRow.is_admin),
    is_active: Boolean(userRow.is_active),
    total_coins: (userRow.total_coins as number | null) ?? 0,
    ws_streak: (userRow.ws_streak as number | null) ?? null,
    revit_streak: (userRow.revit_streak as number | null) ?? null,
    rank_ws: (userRow.rank_ws as number | null) ?? null,
    rank_revit: (userRow.rank_revit as number | null) ?? null,
    balance_mismatch: Boolean(userRow.balance_mismatch),
  }

  const today = await getMinskToday(supabase)
  const fromDay = CALENDAR_START

  const [
    wsStreakRes,
    revitStreakRes,
    statusesRes,
    absencesRes,
    launchesRes,
    shieldsRes,
    txsRes,
    correctionsRes,
    topCountWsRes,
    topCountRevitRes,
    eventTypesRes,
    appealsRes,
  ] = await Promise.all([
    supabase
      .from('ws_user_streaks_effective')
      .select('current_streak, longest_streak, completed_cycles, streak_start_date, pending_reset_date, pending_reset_expires_at')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('revit_user_streaks_effective')
      .select('current_streak, best_streak, completed_cycles, streak_start_date, pending_reset_date, pending_reset_expires_at')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('ws_daily_statuses')
      .select('date, status, absence_type')
      .eq('user_id', userId)
      .gte('date', fromDay)
      .lte('date', today)
      .order('date', { ascending: true }),
    supabase
      .from('ws_user_absences')
      .select('absence_date, absence_type')
      .eq('user_id', userId)
      .gte('absence_date', fromDay)
      .lte('absence_date', today),
    supabase
      .from('elk_plugin_launches')
      .select('work_date, launch_count')
      .eq('user_email', user.email.toLowerCase())
      .gte('work_date', fromDay)
      .lte('work_date', today),
    supabase
      .from('streak_shield_log')
      .select('protected_date, shield_type')
      .eq('user_id', userId)
      .gte('protected_date', fromDay)
      .lte('protected_date', today),
    supabase
      .from('view_user_transactions')
      .select('transaction_id, event_date, event_type, source, coins, description, details, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('admin_corrections')
      .select('*')
      .eq('target_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30),
    supabase.from('view_top_pers_ws').select('*', { count: 'exact', head: true }),
    supabase.from('view_top_pers_revit').select('*', { count: 'exact', head: true }),
    supabase
      .from('gamification_event_types')
      .select('key, name, coins, is_active')
      .eq('is_active', true)
      .order('coins', { ascending: false }),
    supabase
      .from('feedback')
      .select('id, created_at, status, description, appeal_task_url, appeal_dates, appeal_transaction_ids, appeal_total_coins, image_urls, review_comment, reviewed_at')
      .eq('type', 'appeal')
      .eq('ws_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  if (wsStreakRes.error) throw new Error(wsStreakRes.error.message)
  if (revitStreakRes.error) throw new Error(revitStreakRes.error.message)
  if (statusesRes.error) throw new Error(statusesRes.error.message)
  if (absencesRes.error) throw new Error(absencesRes.error.message)
  if (launchesRes.error) throw new Error(launchesRes.error.message)
  if (shieldsRes.error) throw new Error(shieldsRes.error.message)
  if (txsRes.error) throw new Error(txsRes.error.message)
  if (correctionsRes.error) throw new Error(correctionsRes.error.message)

  // Монет за green_day берём из транзакций пользователя. У ws-событий event_date
  // сдвинут +1 триггером trg_fix_ws_event_date — для совпадения с рабочим днём
  // в календаре вычитаем 1 день (ranking_date во view_user_transactions нет).
  const greenDayCoinsByDate = new Map<string, number>()
  for (const tx of txsRes.data ?? []) {
    if (!['green_day', 'streak_daily_bonus'].includes(tx.event_type) || tx.source !== 'ws') continue
    const eventDate = tx.event_date as string | null
    if (!eventDate) continue
    const workDay = addDaysIso(eventDate, -1)
    greenDayCoinsByDate.set(workDay, (greenDayCoinsByDate.get(workDay) ?? 0) + (tx.coins as number))
  }

  const calendar = buildCalendar({
    fromDay,
    today,
    statuses: (statusesRes.data ?? []) as Array<{
      date: string
      status: 'green' | 'red' | 'absent'
      absence_type: string | null
    }>,
    absences: (absencesRes.data ?? []) as Array<{ absence_date: string; absence_type: string }>,
    launches: (launchesRes.data ?? []) as Array<{ work_date: string; launch_count: number }>,
    shields: (shieldsRes.data ?? []) as Array<{ protected_date: string; shield_type: string }>,
    greenDayCoins: greenDayCoinsByDate,
  })

  const transactions: CorrectionTransaction[] = (txsRes.data ?? []).map((row) => ({
    transaction_id: row.transaction_id as string,
    event_date: row.event_date as string,
    event_type: row.event_type as string,
    source: row.source as string,
    coins: row.coins as number,
    description: (row.description as string | null) ?? null,
    details: toRecord(row.details),
    created_at: row.created_at as string,
  }))

  const corrections: AdminCorrectionRow[] = (correctionsRes.data ?? []).map(mapAdminCorrection)

  // Собираем все уникальные ID транзакций из обжалований и обогащаем одним запросом
  const allTxIds = new Set<string>()
  for (const row of appealsRes.data ?? []) {
    const ids = row.appeal_transaction_ids as string[] | null
    if (ids) for (const id of ids) allTxIds.add(id)
  }

  const txDetailsMap = new Map<string, { event_date: string; coins: number; description: string }>()
  if (allTxIds.size > 0) {
    const { data: txsData } = await supabase
      .from('view_user_transactions')
      .select('transaction_id, event_date, coins, description, event_type')
      .in('transaction_id', Array.from(allTxIds))
    for (const t of txsData ?? []) {
      const rawDesc = (t.description as string | null) ?? null
      txDetailsMap.set(t.transaction_id as string, {
        event_date: t.event_date as string,
        coins: t.coins as number,
        description: rawDesc && rawDesc.trim().length > 0 ? rawDesc.trim() : (t.event_type as string),
      })
    }
  }

  const appeals: CorrectionUserAppeal[] = (appealsRes.data ?? []).map((row) => {
    const txIds = (row.appeal_transaction_ids as string[] | null) ?? []
    const transactions = txIds
      .map((id) => {
        const det = txDetailsMap.get(id)
        if (!det) return null
        return { id, event_date: det.event_date, coins: det.coins, description: det.description }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
    return {
      id: row.id as string,
      created_at: row.created_at as string,
      status: row.status as CorrectionUserAppeal['status'],
      description: (row.description as string | null) ?? null,
      task_url: (row.appeal_task_url as string | null) ?? null,
      dates: (row.appeal_dates as string[] | null) ?? null,
      transactions,
      total_coins: (row.appeal_total_coins as number | null) ?? null,
      image_urls: (row.image_urls as string[] | null) ?? [],
      review_comment: (row.review_comment as string | null) ?? null,
      reviewed_at: (row.reviewed_at as string | null) ?? null,
    }
  })

  return {
    user,
    balance: {
      current: user.total_coins,
      transaction_sum: (userRow.tx_sum as number | null) ?? 0,
      delta: user.total_coins - ((userRow.tx_sum as number | null) ?? 0),
    },
    ws_streak: {
      current: (wsStreakRes.data?.current_streak as number | null) ?? null,
      longest: (wsStreakRes.data?.longest_streak as number | null) ?? null,
      start_date: (wsStreakRes.data?.streak_start_date as string | null) ?? null,
      completed_cycles: (wsStreakRes.data?.completed_cycles as number | null) ?? 0,
      pending_reset_date: (wsStreakRes.data?.pending_reset_date as string | null) ?? null,
      pending_reset_expires_at: (wsStreakRes.data?.pending_reset_expires_at as string | null) ?? null,
    },
    revit_streak: {
      current: (revitStreakRes.data?.current_streak as number | null) ?? null,
      best: (revitStreakRes.data?.best_streak as number | null) ?? null,
      start_date: (revitStreakRes.data?.streak_start_date as string | null) ?? null,
      completed_cycles: (revitStreakRes.data?.completed_cycles as number | null) ?? 0,
      pending_reset_date: (revitStreakRes.data?.pending_reset_date as string | null) ?? null,
      pending_reset_expires_at: (revitStreakRes.data?.pending_reset_expires_at as string | null) ?? null,
    },
    calendar,
    transactions,
    leaderboard: {
      rank_ws: user.rank_ws,
      rank_revit: user.rank_revit,
      total_in_ws: topCountWsRes.count ?? 0,
      total_in_revit: topCountRevitRes.count ?? 0,
    },
    corrections,
    appeals,
    availableEventTypes: (eventTypesRes.data ?? [])
      .filter((e) => ADDABLE_EVENT_TYPES.has(e.key as string))
      .map((e): AvailableEventType => ({
        key: e.key as string,
        name: e.name as string,
        coins: e.coins as number,
        source: sourceForEventType(e.key as string),
      })),
  }
}

// ============================================================
// Внутреннее
// ============================================================

interface BuildCalendarInput {
  fromDay: string
  today: string
  statuses: Array<{ date: string; status: 'green' | 'red' | 'absent'; absence_type: string | null }>
  absences: Array<{ absence_date: string; absence_type: string }>
  launches: Array<{ work_date: string; launch_count: number }>
  shields: Array<{ protected_date: string; shield_type: string }>
  greenDayCoins: Map<string, number>
}

function buildCalendar({ fromDay, today, statuses, absences, launches, shields, greenDayCoins }: BuildCalendarInput): CorrectionCalendarDay[] {
  const days = new Map<string, CorrectionCalendarDay>()
  let cursor = fromDay
  while (cursor <= today) {
    days.set(cursor, {
      date: cursor,
      status: 'neutral',
      label: 'Нет данных',
      coins: 0,
      absence_type: null,
      revit_launches: 0,
      has_shield: false,
    })
    cursor = addDaysIso(cursor, 1)
  }

  for (const s of statuses) {
    const day = days.get(s.date)
    if (!day) continue
    if (s.status === 'green') {
      day.status = 'green'
      day.label = 'Зелёный день'
      day.coins = greenDayCoins.get(s.date) ?? 0
    } else if (s.status === 'red') {
      day.status = 'red'
      day.label = 'Красный день'
    } else if (s.status === 'absent') {
      day.status = 'absent'
      day.absence_type = s.absence_type
      day.label = absenceLabel(s.absence_type)
    }
  }

  for (const a of absences) {
    const day = days.get(a.absence_date)
    if (!day) continue
    if (day.status === 'neutral' || day.status === 'red') {
      day.status = 'absent'
      day.absence_type = a.absence_type
      day.label = absenceLabel(a.absence_type)
    } else if (!day.absence_type) {
      day.absence_type = a.absence_type
    }
  }

  for (const l of launches) {
    const day = days.get(l.work_date)
    if (!day) continue
    day.revit_launches += l.launch_count
    if (day.status === 'neutral') {
      day.status = 'revit'
      day.label = 'Revit-запуск'
    }
  }

  for (const sh of shields) {
    const day = days.get(sh.protected_date)
    if (!day) continue
    day.has_shield = true
  }

  return [...days.values()]
}

function absenceLabel(absenceType: string | null): string {
  switch (absenceType) {
    case 'vacation':
      return 'Отпуск'
    case 'sick_leave':
      return 'Больничный'
    case 'sick_day':
      return 'Отгул по болезни'
    case 'day_off':
      return 'Выходной'
    default:
      return 'Отсутствие'
  }
}

function mapAdminCorrection(row: Record<string, unknown>): AdminCorrectionRow {
  const plannedRaw = row.planned_steps
  const executedRaw = row.executed_steps
  return {
    id: row.id as string,
    correction_type: row.correction_type as AdminCorrectionRow['correction_type'],
    status: row.status as AdminCorrectionRow['status'],
    admin_user_id: (row.admin_user_id as string | null) ?? null,
    target_user_id: row.target_user_id as string,
    reason: row.reason as string,
    input_payload: toRecord(row.input_payload),
    preview_snapshot: toRecord(row.preview_snapshot),
    planned_steps: Array.isArray(plannedRaw) ? (plannedRaw as AdminCorrectionRow['planned_steps']) : [],
    executed_steps: Array.isArray(executedRaw) ? (executedRaw as AdminCorrectionRow['executed_steps']) : [],
    created_event_ids: (row.created_event_ids as string[] | null) ?? [],
    created_transaction_ids: (row.created_transaction_ids as string[] | null) ?? [],
    error_message: (row.error_message as string | null) ?? null,
    created_at: row.created_at as string,
    started_at: (row.started_at as string | null) ?? null,
    finished_at: (row.finished_at as string | null) ?? null,
    updated_at: row.updated_at as string,
  }
}
