import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/modules/auth/queries'
import { getAchievementProgress } from '@/modules/achievements'
import { ProgressCard } from '@/modules/achievements/components/ProgressCard'
import { TrophyShelf } from '@/modules/achievements/components/TrophyShelf'

function getMonthName(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
}

export default async function AchievementsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const progress = user.wsUserId ? await getAchievementProgress(user.wsUserId) : null

  const periodStart = progress?.period_start ?? ''
  const periodEnd = progress?.period_end ?? ''
  const totalDays = periodEnd ? new Date(periodEnd).getDate() : 30
  const daysElapsed = periodStart
    ? Math.min(
        Math.floor((Date.now() - new Date(periodStart).getTime()) / 86400000) + 1,
        totalDays
      )
    : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-fade-in-up">
        <h1 className="text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
          Мои достижения
        </h1>
        <p className="text-sm font-medium mt-1" style={{ color: 'var(--text-secondary)' }}>
          {periodStart ? getMonthName(periodStart) : 'Текущий месяц'}
        </p>
      </div>

      {/* Прогресс текущего месяца */}
      {progress && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 animate-fade-in-up stagger-1">
          <ProgressCard
            entityType="user"
            items={progress.personal}
            daysElapsed={daysElapsed}
            periodDays={totalDays}
          />
          <ProgressCard
            entityType="team"
            groupLabel={progress.team ? `Команда: ${progress.team}` : 'Команда'}
            items={progress.team_progress}
            daysElapsed={daysElapsed}
            periodDays={totalDays}
          />
          <ProgressCard
            entityType="department"
            groupLabel={progress.department ? `Отдел: ${progress.department}` : 'Отдел'}
            items={progress.department_progress}
            daysElapsed={daysElapsed}
            periodDays={totalDays}
          />
        </div>
      )}

      {/* Стенд кубков */}
      <div className="animate-fade-in-up stagger-2">
        <TrophyShelf awards={progress?.awards ?? []} />
      </div>
    </div>
  )
}
