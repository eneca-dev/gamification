// Стрик пользователя по ревиту
export interface RevitStreak {
  current_streak: number
  best_streak: number
  last_green_date: string | null
  is_frozen: boolean
}

// Запись в лидерборде автоматизации
export interface AutomationLeaderboardEntry {
  email: string
  fullName: string
  totalCoins: number
  launchCount: number
  isCurrentUser: boolean
}

// Сводка за вчера: плагины + 💎
export interface RevitYesterdaySummary {
  pluginCount: number
  coinsEarned: number
}

// Транзакция по ревиту для ленты операций
export interface RevitTransaction {
  eventType: string
  eventDate: string
  coins: number
  description: string
  pluginName: string | null
  launchCount: number | null
  createdAt: string
}

// Данные по отделу для соревнования автоматизации
export interface DepartmentAutomationEntry {
  departmentCode: string
  usersEarning: number
  totalEmployees: number
  totalCoins: number
  contestScore: number
  isCurrentDepartment: boolean
}

// Агрегированные данные для виджета ревита на главной
export interface RevitWidgetData {
  streak: RevitStreak | null
  activeDates: string[]              // 'YYYY-MM-DD' для calendar grid
  yesterdaySummary: RevitYesterdaySummary
}
