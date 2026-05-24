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
  category: 'budget' | 'deadline'
  level: 'L3' | 'L2'
  date: string
  taskName: string | null
  taskUrl: string | null
  maxTime: number | null
  actualTime: number | null
  coins: number | null
  streakWas: number | null
  milestone: number | null
  milestoneTasks: { id: string; name: string; url: string | null; dateClosed: string | null }[] | null
  revokedTasks: { id: string; name: string; url: string | null; dateClosed: string | null }[] | null
  // Deadline-специфичные поля (null для budget событий)
  plannedEnd: string | null
  dateClosed: string | null
}

// ─── Pending-задача (бюджет или срок) ──────────────────────────────────────

export interface PendingBudgetTask {
  category: 'budget' | 'deadline'
  level: 'L3' | 'L2'
  taskName: string
  taskUrl: string | null
  daysRemaining: number
  plannedEnd: string | null
  closedAt: string | null
  closedOnTime: boolean | null  // deadline: закрыта в срок; null для budget
  withinBudget: boolean | null  // budget: в рамках бюджета; null для deadline
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
