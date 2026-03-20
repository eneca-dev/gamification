// Строка из ws_daily_statuses
export interface DayStatusRow {
  date: string
  status: 'green' | 'red' | 'absent'
  absence_type: string | null
  red_reasons: string[] | null
}

// UI-статус ячейки грида
export type CalendarDayStatus =
  | 'green'
  | 'red'
  | 'gray'
  | 'frozen'
  | 'future'
  | 'out'
  | 'no_data'

// День для грида (заменяет WorksectionDay из data.ts)
export interface CalendarDay {
  date: string
  status: CalendarDayStatus
  automation: boolean
  absenceType?: string | null
  redReasons?: string[] | null
}

// Milestone стрика
export interface StreakMilestone {
  days: number
  reward: number
  reached: boolean
}

// Данные стрика WS
export interface WsStreakData {
  currentStreak: number
  longestStreak: number
  streakStartDate: string | null
  completedCycles: number
  milestones: StreakMilestone[]
}

// Данные стрика Revit
export interface RevitStreakData {
  currentStreak: number
  milestones: StreakMilestone[]
}

// Все данные для StreakPanel
export interface StreakPanelData {
  calendarDays: CalendarDay[]
  completedCycles: number
  ws: WsStreakData
  revit: RevitStreakData
}
