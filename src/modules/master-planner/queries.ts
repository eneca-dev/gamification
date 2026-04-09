import { createSupabaseServerClient } from '@/config/supabase'

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

interface ViewRow {
  event_id: string
  user_id: string
  event_type: string
  event_date: string
  level: string
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
}

function mapRowToEvent(row: ViewRow): MasterPlannerEvent {
  return {
    eventId: row.event_id,
    type: row.event_type,
    level: row.level as 'L3' | 'L2',
    date: row.event_date,
    taskName: row.task_name,
    taskUrl: buildTaskUrl(row.ws_project_id, row.ws_l1_id, row.ws_task_id),
    maxTime: row.max_time,
    actualTime: row.actual_time,
    coins: row.coins,
    streakWas: row.streak_was,
    milestone: row.milestone,
    milestoneTasks: row.milestone_tasks,
    revokedTasks: row.revoked_tasks,
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

  // Последние 5 событий из вью
  const { data: recentRows } = await supabase
    .from('view_master_planner_history')
    .select('*')
    .eq('user_id', userId)
    .order('event_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(5)

  // Pending из view_budget_pending_status
  const { data: pendingRows } = await supabase
    .from('view_budget_pending_status')
    .select('level, task_name, ws_project_id, ws_l1_id, ws_task_l3_id, ws_task_l2_id, days_remaining')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('eligible_date', { ascending: true })

  return {
    l3: l3State
      ? { currentStreak: l3State.current_streak, completedCycles: l3State.completed_cycles, reward: 450 }
      : { ...DEFAULT_STREAK, reward: 450 },
    l2: l2State
      ? { currentStreak: l2State.current_streak, completedCycles: l2State.completed_cycles, reward: 400 }
      : { ...DEFAULT_STREAK, reward: 400 },
    recentEvents: (recentRows ?? []).map((r) => mapRowToEvent(r as unknown as ViewRow)),
    pendingTasks: (pendingRows ?? []).map((r) => ({
      level: r.level as 'L3' | 'L2',
      taskName: r.task_name ?? '',
      taskUrl: buildTaskUrl(
        r.ws_project_id,
        r.ws_l1_id,
        r.ws_task_l3_id ?? r.ws_task_l2_id,
      ),
      daysRemaining: r.days_remaining ?? 0,
    })),
  }
}

// ─── Страница истории ───────────────────────────────────────────────────────

const PAGE_SIZE = 20

export async function getMasterPlannerHistory(
  userId: string,
  page: number,
  level?: 'L3' | 'L2',
): Promise<MasterPlannerHistoryData> {
  const supabase = await createSupabaseServerClient()
  const offset = (page - 1) * PAGE_SIZE

  // Основной запрос — данные страницы
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

  const { data: rows, count } = await query

  // Доп. запрос — startPosition для нижней строки страницы
  // Берём события СТАРШЕ текущей страницы, считаем подряд budget_ok от начала
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
    events: (rows ?? []).map((r) => mapRowToEvent(r as unknown as ViewRow)),
    totalCount: count ?? 0,
    startPosition,
  }
}
