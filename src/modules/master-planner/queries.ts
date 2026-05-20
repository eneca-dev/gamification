import { createSupabaseAdminClient, createSupabaseServerClient } from '@/config/supabase'

import type {
  MasterPlannerPanelData,
  MasterPlannerStreakData,
  MasterPlannerEvent,
  PendingBudgetTask,
  MasterPlannerHistoryData,
} from './types'

const WS_BASE = 'https://eneca.worksection.com/project'

const DEFAULT_STREAK: MasterPlannerStreakData = { currentStreak: 0, completedCycles: 0, reward: 0 }

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildTaskUrl(projectId: string | null, l1Id: string | null, taskId: string | null): string | null {
  if (!projectId || !taskId) return null
  if (l1Id) return `${WS_BASE}/${projectId}/${l1Id}/${taskId}/`
  return `${WS_BASE}/${projectId}/${taskId}/`
}

interface BonusTaskInfo {
  url: string | null
  dateClosed: string | null
}

// Подтягивает URL и дату закрытия для milestone_tasks/revoked_tasks (id+name приходят из view).
// Уровень задачи определяется по level события: L3 → ws_tasks_l3, L2 → ws_tasks_l2.
// Использует admin client: на ws_tasks_l3/ws_tasks_l2 включён RLS только для service_role,
// view_master_planner_history работает через SECURITY DEFINER — прямые запросы из user-сессии вернут 0 строк.
async function buildBonusTaskInfoMaps(
  rows: ViewRow[],
): Promise<{ l3: Map<string, BonusTaskInfo>; l2: Map<string, BonusTaskInfo> }> {
  const supabase = createSupabaseAdminClient()
  const l3Ids = new Set<string>()
  const l2Ids = new Set<string>()

  for (const r of rows) {
    const lists = [r.milestone_tasks, r.revoked_tasks]
    for (const list of lists) {
      if (!list) continue
      const target = r.level === 'L2' ? l2Ids : l3Ids
      for (const t of list) target.add(t.id)
    }
  }

  const l3Map = new Map<string, BonusTaskInfo>()
  const l2Map = new Map<string, BonusTaskInfo>()

  if (l3Ids.size > 0) {
    const { data: l3Rows } = await supabase
      .from('ws_tasks_l3')
      .select('ws_task_id, ws_project_id, parent_l2_id, date_closed')
      .in('ws_task_id', [...l3Ids])

    const parentL2Ids = [...new Set((l3Rows ?? []).map((r) => r.parent_l2_id).filter(Boolean) as string[])]
    let l2ToL1 = new Map<string, string>()
    if (parentL2Ids.length > 0) {
      const { data: l2Parents } = await supabase
        .from('ws_tasks_l2')
        .select('ws_task_id, parent_l1_id')
        .in('ws_task_id', parentL2Ids)
      l2ToL1 = new Map(
        (l2Parents ?? []).map((r) => [r.ws_task_id as string, r.parent_l1_id as string]),
      )
    }

    for (const l3 of l3Rows ?? []) {
      const l1Id = l2ToL1.get(l3.parent_l2_id as string) ?? null
      const url = buildTaskUrl(l3.ws_project_id as string | null, l1Id, l3.ws_task_id as string)
      l3Map.set(l3.ws_task_id as string, {
        url,
        dateClosed: (l3.date_closed as string | null) ?? null,
      })
    }
  }

  if (l2Ids.size > 0) {
    const { data: l2Rows } = await supabase
      .from('ws_tasks_l2')
      .select('ws_task_id, ws_project_id, parent_l1_id, date_closed')
      .in('ws_task_id', [...l2Ids])

    for (const l2 of l2Rows ?? []) {
      const url = buildTaskUrl(l2.ws_project_id as string | null, l2.parent_l1_id as string | null, l2.ws_task_id as string)
      l2Map.set(l2.ws_task_id as string, {
        url,
        dateClosed: (l2.date_closed as string | null) ?? null,
      })
    }
  }

  return { l3: l3Map, l2: l2Map }
}

// Подтягивает date_closed задачи для каждого budget-события (для deadline date_closed уже в details).
// Берёт ws_task_id из row.ws_task_id (для revoked-вариантов уже COALESCE'нуто на original_details в view).
async function buildEventTaskClosedAtMap(rows: ViewRow[]): Promise<Map<string, string>> {
  const supabase = createSupabaseAdminClient()
  const l3Ids = new Set<string>()
  const l2Ids = new Set<string>()

  for (const r of rows) {
    if (r.category !== 'budget' || !r.ws_task_id) continue
    if (r.level === 'L2') l2Ids.add(r.ws_task_id)
    else l3Ids.add(r.ws_task_id)
  }

  const map = new Map<string, string>()

  if (l3Ids.size > 0) {
    const { data } = await supabase
      .from('ws_tasks_l3')
      .select('ws_task_id, date_closed')
      .in('ws_task_id', [...l3Ids])
    for (const t of data ?? []) {
      if (t.date_closed) map.set(`l3:${t.ws_task_id}`, t.date_closed as string)
    }
  }

  if (l2Ids.size > 0) {
    const { data } = await supabase
      .from('ws_tasks_l2')
      .select('ws_task_id, date_closed')
      .in('ws_task_id', [...l2Ids])
    for (const t of data ?? []) {
      if (t.date_closed) map.set(`l2:${t.ws_task_id}`, t.date_closed as string)
    }
  }

  return map
}

interface ViewRow {
  event_id: string
  user_id: string
  event_type: string
  event_date: string
  created_at: string
  level: string
  category: string
  ws_task_id: string | null
  task_name: string | null
  ws_project_id: string | null
  ws_l1_id: string | null
  max_time: number | null
  actual_time: number | null
  streak_was: number | null
  milestone: number | null
  milestone_tasks: { id: string; name: string }[] | null
  revoked_tasks: { id: string; name: string }[] | null
  coins: number | null
  planned_end: string | null
  date_closed: string | null
}

function mapRowToEvent(
  row: ViewRow,
  bonusInfoMaps?: { l3: Map<string, BonusTaskInfo>; l2: Map<string, BonusTaskInfo> },
  taskClosedAtMap?: Map<string, string>,
): MasterPlannerEvent {
  const infoMap = row.level === 'L2' ? bonusInfoMaps?.l2 : bonusInfoMaps?.l3
  const enrich = (
    list: { id: string; name: string }[] | null,
  ): { id: string; name: string; url: string | null; dateClosed: string | null }[] | null =>
    list
      ? list.map((t) => {
          const info = infoMap?.get(t.id)
          return { ...t, url: info?.url ?? null, dateClosed: info?.dateClosed ?? null }
        })
      : null

  // Для deadline date_closed уже приходит из details; для budget подмешиваем из ws_tasks_*.
  let dateClosed: string | null = row.date_closed ?? null
  if (!dateClosed && row.category === 'budget' && row.ws_task_id) {
    const key = `${row.level === 'L2' ? 'l2' : 'l3'}:${row.ws_task_id}`
    dateClosed = taskClosedAtMap?.get(key) ?? null
  }

  return {
    eventId: row.event_id,
    type: row.event_type,
    category: (row.category ?? 'budget') as 'budget' | 'deadline',
    level: row.level as 'L3' | 'L2',
    date: row.event_date,
    taskName: row.task_name,
    taskUrl: buildTaskUrl(row.ws_project_id, row.ws_l1_id, row.ws_task_id),
    maxTime: row.max_time,
    actualTime: row.actual_time,
    coins: row.coins,
    streakWas: row.streak_was,
    milestone: row.milestone,
    milestoneTasks: enrich(row.milestone_tasks),
    revokedTasks: enrich(row.revoked_tasks),
    plannedEnd: row.planned_end ?? null,
    dateClosed,
  }
}

// ─── Панель на дашборде ─────────────────────────────────────────────────────

export async function getMasterPlannerPanel(userId: string): Promise<MasterPlannerPanelData> {
  const supabase = await createSupabaseServerClient()

  // Стрики из master_planner_state
  const { data: stateRows } = await supabase
    .from('master_planner_state')
    .select('level, current_streak, completed_cycles')
    .eq('user_id', userId)

  const l3State = stateRows?.find((r) => r.level === 'l3')
  const l2State = stateRows?.find((r) => r.level === 'l2')

  // Последние 5 событий (budget + deadline теперь в одной вью)
  const { data: recentRows } = await supabase
    .from('view_master_planner_history')
    .select('*')
    .eq('user_id', userId)
    .order('event_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(5)

  const recentBonusInfoMaps = await buildBonusTaskInfoMaps((recentRows ?? []) as unknown as ViewRow[])
  const recentTaskClosedAtMap = await buildEventTaskClosedAtMap((recentRows ?? []) as unknown as ViewRow[])

  // Budget pending
  const { data: budgetPendingRows } = await supabase
    .from('view_budget_pending_status')
    .select('level, task_name, ws_project_id, ws_l1_id, ws_task_l3_id, ws_task_l2_id, days_remaining, within_budget')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('eligible_date', { ascending: true })

  // Deadline pending
  const { data: deadlinePendingRows } = await supabase
    .from('view_deadline_pending_status')
    .select('level, task_name, ws_project_id, ws_l1_id, ws_task_l3_id, planned_end, closed_at, closed_on_time, days_remaining, expected_coins')
    .eq('user_id', userId)
    .order('days_remaining', { ascending: true })

  const budgetPending: PendingBudgetTask[] = (budgetPendingRows ?? []).map((r) => ({
    category: 'budget' as const,
    level: r.level as 'L3' | 'L2',
    taskName: r.task_name ?? '',
    taskUrl: buildTaskUrl(r.ws_project_id, r.ws_l1_id, r.ws_task_l3_id ?? r.ws_task_l2_id),
    daysRemaining: r.days_remaining ?? 0,
    plannedEnd: null,
    closedAt: null,
    closedOnTime: null,
    withinBudget: r.within_budget ?? null,
  }))

  const deadlinePending: PendingBudgetTask[] = (deadlinePendingRows ?? []).map((r) => ({
    category: 'deadline' as const,
    level: 'L3' as const,
    taskName: r.task_name ?? '',
    taskUrl: buildTaskUrl(r.ws_project_id, r.ws_l1_id, r.ws_task_l3_id),
    daysRemaining: r.days_remaining ?? 0,
    plannedEnd: r.planned_end ?? null,
    closedAt: r.closed_at ?? null,
    closedOnTime: r.closed_on_time ?? null,
    withinBudget: null,
  }))

  // Объединяем и сортируем по срочности
  const allPending = [...budgetPending, ...deadlinePending]
    .sort((a, b) => a.daysRemaining - b.daysRemaining)

  return {
    l3: l3State
      ? { currentStreak: l3State.current_streak, completedCycles: l3State.completed_cycles, reward: 450 }
      : { ...DEFAULT_STREAK, reward: 450 },
    l2: l2State
      ? { currentStreak: l2State.current_streak, completedCycles: l2State.completed_cycles, reward: 400 }
      : { ...DEFAULT_STREAK, reward: 400 },
    recentEvents: (recentRows ?? []).map((r) => mapRowToEvent(r as unknown as ViewRow, recentBonusInfoMaps, recentTaskClosedAtMap)),
    pendingTasks: allPending,
  }
}

// ─── Все budget pending-задачи (для страницы истории) ─────────────────────

export async function getAllPendingTasks(
  userId: string,
  level?: 'L3' | 'L2',
): Promise<PendingBudgetTask[]> {
  const supabase = await createSupabaseServerClient()

  let query = supabase
    .from('view_budget_pending_status')
    .select('level, task_name, ws_project_id, ws_l1_id, ws_task_l3_id, ws_task_l2_id, days_remaining, within_budget')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('eligible_date', { ascending: true })

  if (level) {
    query = query.eq('level', level)
  }

  const { data: rows } = await query

  return (rows ?? []).map((r) => ({
    category: 'budget' as const,
    level: r.level as 'L3' | 'L2',
    taskName: r.task_name ?? '',
    taskUrl: buildTaskUrl(r.ws_project_id, r.ws_l1_id, r.ws_task_l3_id ?? r.ws_task_l2_id),
    daysRemaining: r.days_remaining ?? 0,
    plannedEnd: null,
    closedAt: null,
    closedOnTime: null,
    withinBudget: r.within_budget ?? null,
  }))
}

// ─── Все deadline pending-задачи (для страницы истории) ───────────────────

export async function getAllDeadlinePendingTasks(userId: string): Promise<PendingBudgetTask[]> {
  const supabase = await createSupabaseServerClient()

  const { data: rows } = await supabase
    .from('view_deadline_pending_status')
    .select('level, task_name, ws_project_id, ws_l1_id, ws_task_l3_id, planned_end, closed_at, closed_on_time, days_remaining')
    .eq('user_id', userId)
    .order('days_remaining', { ascending: true })

  return (rows ?? []).map((r) => ({
    category: 'deadline' as const,
    level: 'L3' as const,
    taskName: r.task_name ?? '',
    taskUrl: buildTaskUrl(r.ws_project_id, r.ws_l1_id, r.ws_task_l3_id),
    daysRemaining: r.days_remaining ?? 0,
    plannedEnd: r.planned_end ?? null,
    closedAt: r.closed_at ?? null,
    closedOnTime: r.closed_on_time ?? null,
    withinBudget: null,
  }))
}

// ─── Страница истории ───────────────────────────────────────────────────────

const PAGE_SIZE = 20

export type HistoryStatusFilter = 'ok' | 'exceeded' | 'revoked'
export type HistoryCategoryFilter = 'budget' | 'deadline'

function buildEventTypeOrFilter(
  status?: HistoryStatusFilter,
  category?: HistoryCategoryFilter,
): string | null {
  const conds: string[] = []

  if (status === 'ok') {
    if (!category || category === 'budget') conds.push('event_type.like.budget_ok%')
    if (!category || category === 'deadline') conds.push('event_type.eq.deadline_ok_l3')
  } else if (status === 'exceeded') {
    conds.push('event_type.like.budget_exceeded%')
  } else if (status === 'revoked') {
    if (!category || category === 'budget') conds.push('event_type.like.budget_revoked%')
    if (!category || category === 'deadline') conds.push('event_type.eq.deadline_revoked_l3')
  } else if (category === 'budget') {
    conds.push('event_type.like.budget%', 'event_type.like.master_planner%')
  } else if (category === 'deadline') {
    conds.push('event_type.like.deadline%')
  }

  return conds.length > 0 ? conds.join(',') : null
}

export async function getMasterPlannerHistory(
  userId: string,
  page: number,
  level?: 'L3' | 'L2',
  status?: HistoryStatusFilter,
  category?: HistoryCategoryFilter,
): Promise<MasterPlannerHistoryData> {
  const supabase = await createSupabaseServerClient()
  const offset = (page - 1) * PAGE_SIZE

  let query = supabase
    .from('view_master_planner_history')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('event_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (level) {
    query = query.eq('level', level)
  }
  const orFilter = buildEventTypeOrFilter(status, category)
  if (orFilter) {
    query = query.or(orFilter)
  }

  const { data: rows, count } = await query

  const historyBonusInfoMaps = await buildBonusTaskInfoMaps((rows ?? []) as unknown as ViewRow[])
  const historyTaskClosedAtMap = await buildEventTaskClosedAtMap((rows ?? []) as unknown as ViewRow[])

  // Доп. запрос — startPosition для нижней строки страницы
  let startPosition = 0
  const tailOffset = offset + PAGE_SIZE

  if (count != null && tailOffset < count) {
    let tailQuery = supabase
      .from('view_master_planner_history')
      .select('event_type')
      .eq('user_id', userId)
      .order('event_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(tailOffset, tailOffset + 199)

    if (level) {
      tailQuery = tailQuery.eq('level', level)
    }
    const tailOrFilter = buildEventTypeOrFilter(status, category)
    if (tailOrFilter) {
      tailQuery = tailQuery.or(tailOrFilter)
    }

    const { data: tailRows } = await tailQuery

    for (const r of tailRows ?? []) {
      const t = r.event_type as string
      if (t.startsWith('budget_ok')) {
        startPosition++
      } else {
        break
      }
    }
  }

  return {
    events: (rows ?? []).map((r) => mapRowToEvent(r as unknown as ViewRow, historyBonusInfoMaps, historyTaskClosedAtMap)),
    totalCount: count ?? 0,
    startPosition,
  }
}
