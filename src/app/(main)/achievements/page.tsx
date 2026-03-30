import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/modules/auth/queries'
import { getAchievementProgress, getGratitudeAchievementProgress } from '@/modules/achievements'
import { RankingBlock, GratitudeBlock } from '@/modules/achievements/components/AchievementBlock'
import { TrophyShelf } from '@/modules/achievements/components/TrophyShelf'

function getMonthName(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
}

export default async function AchievementsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const [progress, gratitudeProgress] = await Promise.all([
    user.wsUserId ? getAchievementProgress(user.wsUserId) : null,
    user.wsUserId ? getGratitudeAchievementProgress(user.wsUserId) : [],
  ])

  const periodStart = progress?.period_start ?? ''
  const periodEnd = progress?.period_end ?? ''
  const totalDays = periodEnd ? new Date(periodEnd).getDate() : 30
  const daysElapsed = periodStart
    ? Math.min(
        Math.floor((Date.now() - new Date(periodStart).getTime()) / 86400000) + 1,
        totalDays
      )
    : 0

  const teamName = progress?.team ?? null
  const deptName = progress?.department ?? null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-fade-in-up">
        <h1 className="text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
          Путь к достижениям
        </h1>
        <p className="text-sm font-medium mt-1" style={{ color: 'var(--text-secondary)' }}>
          {periodStart ? getMonthName(periodStart) : 'Текущий месяц'} — день {daysElapsed} из {totalDays}
        </p>
      </div>

      {/* 3 блока: Revit / WS / Благодарности */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 animate-fade-in-up stagger-1">
        <RankingBlock
          area="revit"
          title="Revit"
          personalProgress={progress?.personal.find((p) => p.area === 'revit') ?? null}
          teamProgress={progress?.team_progress.find((p) => p.area === 'revit') ?? null}
          deptProgress={progress?.department_progress.find((p) => p.area === 'revit') ?? null}
          teamName={teamName}
          deptName={deptName}
          daysElapsed={daysElapsed}
          periodDays={totalDays}
        />

        <RankingBlock
          area="ws"
          title="Worksection"
          personalProgress={progress?.personal.find((p) => p.area === 'ws') ?? null}
          teamProgress={progress?.team_progress.find((p) => p.area === 'ws') ?? null}
          deptProgress={progress?.department_progress.find((p) => p.area === 'ws') ?? null}
          teamName={teamName}
          deptName={deptName}
          daysElapsed={daysElapsed}
          periodDays={totalDays}
        />

        <GratitudeBlock items={gratitudeProgress} />
      </div>

      {/* Стенд кубков */}
      <div className="animate-fade-in-up stagger-2">
        <TrophyShelf awards={progress?.awards ?? []} />
      </div>
    </div>
  )
}
