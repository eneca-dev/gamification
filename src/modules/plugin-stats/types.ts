export interface AutomationStreakData {
  currentDays: number
  activeDates: string[] // 'YYYY-MM-DD'
}

export interface AutomationLeaderboardEntry {
  email: string
  fullName: string
  launchCount: number
  isCurrentUser: boolean
}
