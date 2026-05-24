export { getDepartmentFeedData, getTeamFeedData } from './queries'
// getTeamFeedData принимает team: string | null (null = пользователи без команды)
export type { DepartmentFeedData, TeamFeedData, PersonFeedRow, TeamFeedRow, AchievementBadge, GratitudeBadge, AchBreakdown } from './types'
