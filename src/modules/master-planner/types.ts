// ─── Данные стрика (из master_planner_state) ───────────────────────────────

export interface MasterPlannerStreakData {
  currentStreak: number
  completedCycles: number
  reward: number
}

// ─── Событие для списка последних / истории ─────────────────────────────────

export interface MasterPlannerEvent {
  eventId: string
  type: string
  level: 'L3' | 'L2'
  date: string
  taskName: string | null
  taskUrl: string | null
  maxTime: number | null
  actualTime: number | null
  coins: number | null
  streakWas: number | null
  milestone: number | null
  milestoneTasks: { id: string; name: string }[] | null
  revokedTasks: { id: string; name: string }[] | null
}

// ─── Pending-задача ─────────────────────────────────────────────────────────

export interface PendingBudgetTask {
  level: 'L3' | 'L2'
  taskName: string
  taskUrl: string | null
  daysRemaining: number
}

// ─── Данные для панели на дашборде ──────────────────────────────────────────

export interface MasterPlannerPanelData {
  l3: MasterPlannerStreakData
  l2: MasterPlannerStreakData
  recentEvents: MasterPlannerEvent[]
  pendingTasks: PendingBudgetTask[]
}

// ─── Данные для страницы истории ─────────────────────────────────────────────

export interface MasterPlannerHistoryData {
  events: MasterPlannerEvent[]
  totalCount: number
  startPosition: number
}
