export interface AutomationStreakData {
  currentDays: number
  bestDays: number
  lastGreenDate: string | null
  activeDates: string[] // 'YYYY-MM-DD'
}

export interface AutomationLeaderboardEntry {
  email: string
  fullName: string
  launchCount: number
  isCurrentUser: boolean
}
