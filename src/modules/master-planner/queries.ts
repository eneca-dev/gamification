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

// Подтягивает URL для milestone_tasks/revoked_tasks (id+name приходят из view, без проекта/parent).
// Уровень задачи определяется по level события: L3 → ws_tasks_l3, L2 → ws_tasks_l2.
// Использует admin client: на ws_tasks_l3/ws_tasks_l2 включён RLS только для service_role,
// view_master_planner_history работает через SECURITY DEFINER — прямые запросы из user-сессии вернут 0 строк.
async function buildBonusTaskUrlMaps(
  rows: ViewRow[],
): Promise<{ l3: Map<string, string>; l2: Map<string, string> }> {
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

  const l3UrlMap = new Map<string, string>()
  const l2UrlMap = new Map<string, string>()

  if (l3Ids.size > 0) {
    const { data: l3Rows } = await supabase
      .from('ws_tasks_l3')
      .select('ws_task_id, ws_project_id, parent_l2_id')
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
      if (url) l3UrlMap.set(l3.ws_task_id as string, url)
    }
  }

  if (l2Ids.size > 0) {
    const { data: l2Rows } = await supabase
      .from('ws_tasks_l2')
      .select('ws_task_id, ws_project_id, parent_l1_id')
      .in('ws_task_id', [...l2Ids])

    for (const l2 of l2Rows ?? []) {
      const url = buildTaskUrl(l2.ws_project_id as string | null, l2.parent_l1_id as string | null, l2.ws_task_id as string)
      if (url) l2UrlMap.set(l2.ws_task_id as string, url)
    }
  }

  return { l3: l3UrlMap, l2: l2UrlMap }
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
  bonusUrlMaps?: { l3: Map<string, string>; l2: Map<string, string> },
): MasterPlannerEvent {
  const urlMap = row.level === 'L2' ? bonusUrlMaps?.l2 : bonusUrlMaps?.l3
  const enrich = (
    list: { id: string; name: string }[] | null,
  ): { id: string; name: string; url: string | null }[] | null =>
    list ? list.map((t) => ({ ...t, url: urlMap?.get(t.id) ?? null })) : null

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
    dateClosed: row.date_closed ?? null,
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

  const recentBonusUrlMaps = await buildBonusTaskUrlMaps((recentRows ?? []) as unknown as ViewRow[])

  // Budget pending
  const { data: budgetPendingRows } = await supabase
    .from('view_budget_pending_status')
    .select('level, task_name, ws_project_id, ws_l1_id, ws_task_l3_id, ws_task_l2_id, days_remaining')
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
    recentEvents: (recentRows ?? []).map((r) => mapRowToEvent(r as unknown as ViewRow, recentBonusUrlMaps)),
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
    .select('level, task_name, ws_project_id, ws_l1_id, ws_task_l3_id, ws_task_l2_id, days_remaining')
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
  }))
}

// ─── Страница истории ───────────────────────────────────────────────────────

const PAGE_SIZE = 20

export type HistoryStatusFilter = 'ok' | 'exceeded' | 'revoked'

const STATUS_FILTER_PATTERNS: Record<HistoryStatusFilter, string> = {
  ok: 'budget_ok%',
  exceeded: 'budget_exceeded%',
  revoked: 'budget_revoked%',
}

export async function getMasterPlannerHistory(
  userId: string,
  page: number,
  level?: 'L3' | 'L2',
  status?: HistoryStatusFilter,
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
  if (status) {
    query = query.like('event_type', STATUS_FILTER_PATTERNS[status])
  }

  const { data: rows, count } = await query

  const historyBonusUrlMaps = await buildBonusTaskUrlMaps((rows ?? []) as unknown as ViewRow[])

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
    if (status) {
      tailQuery = tailQuery.like('event_type', STATUS_FILTER_PATTERNS[status])
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
    events: (rows ?? []).map((r) => mapRowToEvent(r as unknown as ViewRow, historyBonusUrlMaps)),
    totalCount: count ?? 0,
    startPosition,
  }
}
