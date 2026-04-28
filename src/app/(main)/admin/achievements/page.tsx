import {
  getRankingProgressAll,
  getGratitudeProgressAll,
  getRevitDepartmentRanking,
  getRevitTeamRanking,
  getWsDepartmentRanking,
  getWsTeamRanking,
} from '@/modules/achievements'
import { getUsersLight } from '@/modules/admin'
import { AchievementProgressAdmin } from '@/modules/admin/components/AchievementProgressAdmin'
import { ContestStandingsAdmin } from '@/modules/admin/components/ContestStandingsAdmin'
import { getContestWinners } from '@/modules/contests'

export default async function AdminAchievementsPage() {
  const [
    rankingProgress, gratitudeProgress, users,
    revitDeptStandings, revitTeamStandings, wsDeptStandings, wsTeamStandings,
    winners,
  ] = await Promise.all([
    getRankingProgressAll(),
    getGratitudeProgressAll(),
    getUsersLight(),
    getRevitDepartmentRanking(1),
    getRevitTeamRanking(1),
    getWsDepartmentRanking(1),
    getWsTeamRanking(1),
    getContestWinners(4),
  ])

  return (
    <div className="space-y-6">
      <AchievementProgressAdmin
        rankingProgress={rankingProgress}
        gratitudeProgress={gratitudeProgress}
        users={users}
      />
      <ContestStandingsAdmin
        revitDeptStandings={revitDeptStandings}
        revitTeamStandings={revitTeamStandings}
        wsDeptStandings={wsDeptStandings}
        wsTeamStandings={wsTeamStandings}
        winners={winners}
      />
    </div>
  )
}
