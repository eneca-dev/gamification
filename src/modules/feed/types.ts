import type { CompanyAward } from '@/modules/achievements/types'
import type { GratitudeNew } from '@/modules/gratitudes/types'

export interface AchievementBadge {
  area: 'revit' | 'ws' | 'gratitude' | 'gratitude_help' | 'gratitude_quality' | 'gratitude_mentoring'
  daysInTop: number
  threshold: number
  earned: boolean
}

export interface GratitudeBadge {
  category: string | null
}

export interface AchBreakdown {
  user: number
  team: number
  department?: number
}

export interface PersonFeedRow {
  userId: string
  name: string
  revitCoins: number
  wsCoins: number
  achievements: AchievementBadge[]
  gratitudes: GratitudeBadge[]
}

export interface TeamFeedRow {
  team: string
  revitCoins: number
  wsCoins: number
  earnedAchievementsCount: number
  achBreakdown: AchBreakdown
  gratitudesCount: number
  achievements: AchievementBadge[]
  members: PersonFeedRow[]
}

export interface DepartmentFeedData {
  department: string
  revitCoins: number
  wsCoins: number
  earnedAchievementsCount: number
  achBreakdown: AchBreakdown
  gratitudesCount: number
  achievements: AchievementBadge[]
  teams: TeamFeedRow[]
  awards: CompanyAward[]
  feedGratitudes: GratitudeNew[]
}

export interface TeamFeedData {
  team: string
  department: string
  revitCoins: number
  wsCoins: number
  earnedAchievementsCount: number
  achBreakdown: AchBreakdown
  gratitudesCount: number
  achievements: AchievementBadge[]
  members: PersonFeedRow[]
  awards: CompanyAward[]
  feedGratitudes: GratitudeNew[]
}
