import { getRankingProgressAll, getGratitudeProgressAll } from '@/modules/achievements'
import { getUsersLight } from '@/modules/admin'
import { AchievementProgressAdmin } from '@/modules/admin/components/AchievementProgressAdmin'

export default async function AdminAchievementsPage() {
  const [rankingProgress, gratitudeProgress, users] = await Promise.all([
    getRankingProgressAll(),
    getGratitudeProgressAll(),
    getUsersLight(),
  ])

  return (
    <AchievementProgressAdmin
      rankingProgress={rankingProgress}
      gratitudeProgress={gratitudeProgress}
      users={users}
    />
  )
}
