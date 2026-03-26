'use client'

import { useState } from 'react'
import { Trophy, Users, Building2, Zap, Star, Target, Award, Crown, Shield } from 'lucide-react'

import type { AchievementProgress, AchievementEntityType, AchievementAward } from '@/modules/achievements/index.client'
import { ACHIEVEMENT_BONUSES } from '@/modules/achievements/index.client'

// Уникальная конфигурация для каждого бейджа
const BADGE_CONFIG: Record<AchievementEntityType, {
  icon: typeof Trophy
  label: string
  topLabel: string
  topSize: number
  color: string
  earnedColor: string
}> = {
  user: {
    icon: Star,
    label: 'Лидер автоматизации',
    topLabel: 'Топ-10 сотрудников',
    topSize: 10,
    color: 'var(--orange-500)',
    earnedColor: 'var(--apex-success-text)',
  },
  team: {
    icon: Shield,
    label: 'Команда-звезда',
    topLabel: 'Топ-5 команд',
    topSize: 5,
    color: 'var(--apex-info-text)',
    earnedColor: 'var(--apex-success-text)',
  },
  department: {
    icon: Crown,
    label: 'Элитный отдел',
    topLabel: 'Топ-5 отделов',
    topSize: 5,
    color: 'var(--tag-purple-text)',
    earnedColor: 'var(--apex-success-text)',
  },
}

function getMonthName(periodStart: string): string {
  return new Date(periodStart).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
}

function formatAwardMonth(periodStart: string): string {
  return new Date(periodStart).toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' })
}

// Бейдж достижения — всегда отображается
function AchievementBadge({
  entityType,
  progress,
  threshold,
  earned,
  currentRank,
  bonus,
  groupName,
}: {
  entityType: AchievementEntityType
  progress: number
  threshold: number
  earned: boolean
  currentRank: number | null
  bonus: number
  groupName?: string
}) {
  const [showTooltip, setShowTooltip] = useState(false)
  const cfg = BADGE_CONFIG[entityType]
  const Icon = cfg.icon
  const pct = Math.min((progress / threshold) * 100, 100)

  return (
    <div
      className="group relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div
        className="flex flex-col items-center p-3 rounded-xl transition-all cursor-default"
        style={{
          background: earned ? 'var(--apex-success-bg)' : 'var(--surface)',
          border: earned ? '1px solid var(--teal-100)' : '1px solid var(--border)',
        }}
      >
        {/* Иконка с индикатором */}
        <div className="relative mb-1.5">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: earned
                ? 'rgba(var(--apex-primary-rgb), 0.12)'
                : `${cfg.color}14`,
            }}
          >
            <Icon
              size={20}
              style={{ color: earned ? cfg.earnedColor : cfg.color }}
            />
          </div>
          {earned && (
            <div
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
              style={{ background: 'var(--apex-primary)' }}
            >
              <Award size={10} style={{ color: 'white' }} />
            </div>
          )}
        </div>

        {/* Название */}
        <span
          className="text-[10px] font-bold text-center leading-tight mb-0.5"
          style={{ color: earned ? cfg.earnedColor : 'var(--text-primary)' }}
        >
          {cfg.label}
        </span>

        {/* Подпись группы */}
        {groupName && (
          <span className="text-[9px] font-medium text-center leading-tight mb-1 truncate max-w-full" style={{ color: 'var(--text-muted)' }}>
            {groupName}
          </span>
        )}
        {!groupName && entityType === 'user' && (
          <span className="text-[9px] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
            {cfg.topLabel}
          </span>
        )}

        {/* Прогресс-бар */}
        <div className="w-full h-1.5 rounded-full overflow-hidden mb-1" style={{ background: 'var(--border)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              background: earned ? 'var(--apex-primary)' : cfg.color,
              minWidth: progress > 0 ? '4px' : '0px',
            }}
          />
        </div>

        {/* Счётчик */}
        <span
          className="text-[11px] font-extrabold"
          style={{ color: earned ? cfg.earnedColor : progress > 0 ? cfg.color : 'var(--text-muted)' }}
        >
          {progress}/{threshold}
        </span>
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2.5 rounded-xl text-[11px] font-medium w-56 z-50 pointer-events-none"
          style={{
            background: 'var(--text-primary)',
            color: 'white',
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
          }}
        >
          <div className="font-bold mb-1">{cfg.label}</div>
          <div className="space-y-0.5 text-[10px] opacity-90">
            <div>Попадите в {cfg.topLabel.toLowerCase()} по Revit</div>
            {groupName && <div>{entityType === 'team' ? 'Ваша команда' : 'Ваш отдел'}: {groupName}</div>}
            {currentRank && <div>Сейчас: #{currentRank} в рейтинге</div>}
            {!currentRank && <div>Сейчас: не в топе</div>}
            <div>Прогресс: {progress} из {threshold} дней в топе</div>
            <div className="mt-1">Награда: +{bonus} ПК{entityType !== 'user' ? ' каждому' : ''}</div>
            {earned
              ? <div className="font-bold mt-1 text-[11px]">Получено!</div>
              : <div className="mt-1 opacity-70">Выдаётся 1 раз в месяц</div>
            }
          </div>
          <div
            className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 rotate-45"
            style={{ background: 'var(--text-primary)' }}
          />
        </div>
      )}
    </div>
  )
}

// Кубок за прошлый период
function AwardBadge({ award }: { award: AchievementAward }) {
  const cfg = BADGE_CONFIG[award.entity_type]
  const Icon = cfg.icon

  return (
    <div
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
      style={{ background: 'var(--apex-success-bg)', border: '1px solid var(--teal-100)' }}
    >
      <Icon size={11} style={{ color: 'var(--apex-success-text)' }} />
      <span className="text-[10px] font-bold" style={{ color: 'var(--apex-success-text)' }}>
        {cfg.label}
      </span>
      <span className="text-[9px] font-medium" style={{ color: 'var(--text-muted)' }}>
        {formatAwardMonth(award.period_start)}
      </span>
    </div>
  )
}

interface AchievementProgressProps {
  progress: AchievementProgress
}

export function AchievementProgressPanel({ progress }: AchievementProgressProps) {
  const monthName = getMonthName(progress.period_start)
  const totalDays = new Date(progress.period_end).getDate()
  const daysElapsed = Math.min(
    Math.floor((Date.now() - new Date(progress.period_start).getTime()) / 86400000) + 1,
    totalDays
  )

  // Всегда 3 бейджа — личный, командный, отдельский
  const personalRevit = progress.personal.find((p) => p.area === 'revit')
  const teamRevit = progress.team_progress.find((p) => p.area === 'revit')
  const deptRevit = progress.department_progress.find((p) => p.area === 'revit')

  const hasTeam = progress.team && !progress.team.startsWith('Вне команд') && progress.team !== 'Декретный'

  const badges: {
    entityType: AchievementEntityType
    progress: number
    threshold: number
    earned: boolean
    currentRank: number | null
    groupName?: string
  }[] = [
    {
      entityType: 'user',
      progress: personalRevit?.days_in_top ?? 0,
      threshold: 10,
      earned: personalRevit?.earned ?? false,
      currentRank: personalRevit?.current_rank ?? null,
    },
    {
      entityType: 'team',
      progress: teamRevit?.days_in_top ?? 0,
      threshold: 10,
      earned: teamRevit?.earned ?? false,
      currentRank: teamRevit?.current_rank ?? null,
      groupName: hasTeam ? (progress.team ?? undefined) : undefined,
    },
    {
      entityType: 'department',
      progress: deptRevit?.days_in_top ?? 0,
      threshold: 10,
      earned: deptRevit?.earned ?? false,
      currentRank: deptRevit?.current_rank ?? null,
      groupName: progress.department ?? undefined,
    },
  ]

  const earnedCount = badges.filter((b) => b.earned).length

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap size={14} style={{ color: 'var(--orange-500)' }} />
          <div className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Достижения — Revit
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-[11px] font-bold px-2.5 py-0.5 rounded-full capitalize"
            style={{ background: 'var(--surface)', color: 'var(--text-muted)' }}
          >
            {monthName}
          </span>
          {earnedCount > 0 && (
            <span
              className="text-[11px] font-bold px-2.5 py-0.5 rounded-full"
              style={{ background: 'var(--apex-success-bg)', color: 'var(--apex-success-text)' }}
            >
              {earnedCount}/{badges.length}
            </span>
          )}
        </div>
      </div>

      {/* Период */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${(daysElapsed / totalDays) * 100}%`, background: 'var(--text-muted)', opacity: 0.3 }}
          />
        </div>
        <span className="text-[10px] font-medium flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
          День {daysElapsed}/{totalDays}
        </span>
      </div>

      {/* Бейджи — всегда 3 */}
      <div className="grid grid-cols-3 gap-3">
        {badges.map((badge) => (
          <AchievementBadge
            key={badge.entityType}
            entityType={badge.entityType}
            progress={badge.progress}
            threshold={badge.threshold}
            earned={badge.earned}
            currentRank={badge.currentRank}
            bonus={ACHIEVEMENT_BONUSES[badge.entityType]}
            groupName={badge.groupName}
          />
        ))}
      </div>

      {/* Кубки за прошлые периоды */}
      {progress.awards.length > 0 && (
        <div className="mt-4 pt-3 flex flex-wrap gap-1.5" style={{ borderTop: '1px solid var(--border)' }}>
          {progress.awards.slice(0, 5).map((award) => (
            <AwardBadge key={`${award.entity_type}-${award.area}-${award.period_start}`} award={award} />
          ))}
        </div>
      )}
    </div>
  )
}
