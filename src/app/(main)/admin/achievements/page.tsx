import {
  getRankingProgressAll,
  getGratitudeProgressAll,
  getRevitDepartmentRanking,
  getRevitTeamRanking,
  getWsDepartmentRanking,
  getWsTeamRanking,
} from '@/modules/achievements'
import { redirect } from 'next/navigation'

import { checkIsAdmin, getUsersLight } from '@/modules/admin'
import { AchievementProgressAdmin } from '@/modules/admin/components/AchievementProgressAdmin'
import { ContestStandingsAdmin } from '@/modules/admin/components/ContestStandingsAdmin'
import { getContestWinners } from '@/modules/contests'
import { AdminNormControlSection } from '@/modules/ai-norm/components/AdminNormControlSection'
import { getMinskMonth } from '@/modules/ai-norm/queries'

export default async function AdminAchievementsPage({ searchParams }: {
  searchParams: Promise<{ normMonth?: string | string[] }>
}) {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) redirect('/')
  const rawMonth = (await searchParams).normMonth
  const selected = Array.isArray(rawMonth) ? rawMonth[0] : rawMonth
  const normMonth = selected && /^\d{4}-(0[1-9]|1[0-2])$/.test(selected) ? selected : getMinskMonth()

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
      <AdminNormControlSection month={normMonth} />
    </div>
  )
}
