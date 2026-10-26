import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/modules/auth/queries'
import { getAchievementProgress, getGratitudeAchievementProgress } from '@/modules/achievements'
import { RankingBlock, GratitudeBlock } from '@/modules/achievements/components/AchievementBlock'
import { GratitudeBlockLive } from '@/modules/achievements/components/GratitudeBlockLive'
import { TrophyShelf } from '@/modules/achievements/components/TrophyShelf'
import { getMinskMonth, getNormPersonalActivity } from '@/modules/ai-norm/queries'
import { getTenderAdvisorPersonalActivity, getTenderDigestPersonalActivity } from '@/modules/ai-norm/tender-queries'
import { AiUsageCard } from '@/modules/ai-norm/components/AiUsageCard'
import { FileCheck2, SearchCheck, ListFilter } from 'lucide-react'

function getMonthName(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
}

function getDaysElapsed(periodStart: string, totalDays: number): number {
  if (!periodStart) return 0
  return Math.min(Math.floor((Date.now() - new Date(periodStart).getTime()) / 86400000) + 1, totalDays)
}

export default async function AchievementsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const normMonth = getMinskMonth()
  const [progress, gratitudeProgress, normActivity, advisorActivity, digestActivity] = await Promise.all([
    user.wsUserId ? getAchievementProgress(user.wsUserId) : null,
    user.wsUserId ? getGratitudeAchievementProgress(user.wsUserId) : [],
    getNormPersonalActivity(user.email, normMonth).catch((error: unknown) => {
      console.error('Failed to load personal norm activity', error)
      return null
    }),
    getTenderAdvisorPersonalActivity(user.email, normMonth).catch((error: unknown) => {
      console.error('Failed to load Tender Adviser activity', error)
      return null
    }),
    getTenderDigestPersonalActivity(user.email, normMonth).catch((error: unknown) => {
      console.error('Failed to load Tender Digest activity', error)
      return null
    }),
  ])

  const periodStart = progress?.period_start ?? ''
  const periodEnd = progress?.period_end ?? ''
  const totalDays = periodEnd ? new Date(periodEnd).getDate() : 30
  const daysElapsed = getDaysElapsed(periodStart, totalDays)

  const deptName = progress?.department || null
  const teamName = progress?.team || (deptName ? `Вне команд - ${deptName}` : 'Вне команд')

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
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 animate-fade-in-up stagger-1" data-onboarding="achievement-grid">
        <div data-onboarding="ranking-block-first">
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
        </div>

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

        <div data-onboarding="gratitude-block">
          {user.wsUserId
            ? <GratitudeBlockLive userId={user.wsUserId} initialItems={gratitudeProgress} />
            : <GratitudeBlock items={gratitudeProgress} />}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 animate-fade-in-up stagger-2">
        <AiUsageCard title="Нормоконтроль" icon={FileCheck2} month={normMonth}
          events={normActivity?.checks ?? null} dates={normActivity?.dates ?? []}
          eventLabel="Проверок по видам"
          rule="Одна проверка документа за месяц выполняет условие достижения. Число проверок и дней использования показано отдельно." />
        <AiUsageCard title="Tender Adviser" icon={SearchCheck} month={normMonth}
          events={advisorActivity?.events ?? null} dates={advisorActivity?.dates ?? []}
          eventLabel="Запусков"
          rule="Один запуск приложения за месяц выполняет условие достижения. Повторные запуски показаны в статистике." />
        <AiUsageCard title="Tender Digest" icon={ListFilter} month={normMonth}
          events={digestActivity?.events ?? null} dates={digestActivity?.dates ?? []}
          eventLabel="Действий"
          rule="Один просмотр тендера, одно решение по тендеру или одно создание лида за месяц выполняет условие достижения."
          detail="Загрузка списка тендеров не учитывается. Все действия сохраняются в статистике." />
      </div>

      {/* Стенд кубков */}
      <div className="animate-fade-in-up stagger-2">
        <TrophyShelf awards={progress?.awards ?? []} />
      </div>
    </div>
  )
}
