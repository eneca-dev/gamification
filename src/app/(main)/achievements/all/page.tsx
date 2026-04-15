import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Trophy, Zap, CheckCircle, Heart, Users, Building2 } from 'lucide-react'

import { getCurrentUser } from '@/modules/auth/queries'
import { getAchievementProgress } from '@/modules/achievements'
import { CoinIcon } from '@/components/CoinIcon'

import type { AchievementEntityType, AchievementAward } from '@/modules/achievements/types'
import { ACHIEVEMENT_BONUSES } from '@/modules/achievements/types'

const AREA_CONFIG: Record<string, { label: string; icon: typeof Trophy; color: string; bg: string }> = {
  revit: { label: 'Revit', icon: Zap, color: 'var(--tag-orange-text)', bg: 'var(--tag-orange-bg)' },
  ws: { label: 'Worksection', icon: CheckCircle, color: 'var(--apex-primary)', bg: 'var(--apex-success-bg)' },
  gratitude: { label: 'Благодарности', icon: Heart, color: 'var(--tag-purple-text)', bg: 'var(--tag-purple-bg)' },
  gratitude_help: { label: 'Поддержка коллег', icon: Heart, color: 'var(--apex-primary)', bg: 'var(--apex-success-bg)' },
  gratitude_quality: { label: 'Проф. признание', icon: Heart, color: 'var(--tag-orange-text)', bg: 'var(--tag-orange-bg)' },
  gratitude_mentoring: { label: 'Наставничество', icon: Heart, color: 'var(--tag-purple-text)', bg: 'var(--tag-purple-bg)' },
}

const ENTITY_CONFIG: Record<AchievementEntityType, { icon: typeof Trophy; label: string; emoji: string }> = {
  user: { icon: Trophy, label: 'Личное', emoji: '🏆' },
  team: { icon: Users, label: 'Команда', emoji: '🛡️' },
  department: { icon: Building2, label: 'Отдел', emoji: '👑' },
}

const MONTH_NAMES_FULL = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']

function groupByMonth(awards: AchievementAward[]): [string, AchievementAward[]][] {
  const grouped = new Map<string, AchievementAward[]>()
  for (const a of awards) {
    const key = a.period_start.slice(0, 7)
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(a)
  }
  return [...grouped.entries()].sort((a, b) => b[0].localeCompare(a[0]))
}

export default async function AllPersonalAchievementsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const progress = user.wsUserId ? await getAchievementProgress(user.wsUserId) : null
  const awards = progress?.awards ?? []
  const months = groupByMonth(awards)

  return (
    <div className="space-y-6">
      <div className="animate-fade-in-up">
        <Link
          href="/achievements"
          className="inline-flex items-center gap-1.5 text-[13px] font-bold mb-3 transition-opacity hover:opacity-70"
          style={{ color: 'var(--text-muted)' }}
        >
          <ArrowLeft size={14} />
          Достижения
        </Link>
        <div className="flex items-center gap-2">
          <Trophy size={20} style={{ color: 'var(--orange-500)' }} />
          <h1 className="text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
            Все мои достижения
          </h1>
        </div>
        <p className="text-sm font-medium mt-1" style={{ color: 'var(--text-secondary)' }}>
          Полная история ваших достижений
        </p>
      </div>

      <div className="animate-fade-in-up stagger-1">
        {months.length === 0 ? (
          <div
            className="rounded-2xl py-12 text-center"
            style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
          >
            <div className="text-3xl mb-3">🏆</div>
            <div className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>
              Пока нет достижений
            </div>
            <div className="text-[12px] font-medium mt-1" style={{ color: 'var(--text-muted)' }}>
              Держитесь в топе рейтинга 10 дней за период — и получите первое достижение
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {months.map(([monthKey, monthAwards]) => {
              const [y, m] = monthKey.split('-').map(Number)
              const monthLabel = `${MONTH_NAMES_FULL[m - 1]} ${y}`

              return (
                <div key={monthKey}>
                  <div
                    className="text-[11px] font-bold uppercase tracking-wider mb-3"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {monthLabel}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {monthAwards.map((award) => {
                      const areaCfg = AREA_CONFIG[award.area] ?? AREA_CONFIG.gratitude
                      const entityCfg = ENTITY_CONFIG[award.entity_type]
                      const bonus = ACHIEVEMENT_BONUSES[award.entity_type]

                      return (
                        <div
                          key={`${award.entity_type}-${award.area}-${award.period_start}`}
                          className="rounded-2xl p-4 flex flex-col items-center gap-1.5"
                          style={{ background: areaCfg.bg, border: `1px solid ${areaCfg.color}33` }}
                        >
                          <span className="text-3xl">{entityCfg.emoji}</span>
                          <span className="text-[12px] font-bold text-center" style={{ color: areaCfg.color }}>
                            {entityCfg.label}
                          </span>
                          <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
                            {areaCfg.label}
                          </span>
                          <span className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                            <span className="inline-flex items-center gap-0.5">
                              {award.days_in_top} дней &middot; +{bonus} <CoinIcon size={11} />
                            </span>
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
