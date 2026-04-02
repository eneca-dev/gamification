'use client'

import { useState } from 'react'
import { Zap, CheckCircle, Heart } from 'lucide-react'

import type { AreaProgress, AchievementEntityType, GratitudeAchProgress } from '../types'
import { ACHIEVEMENT_BONUSES } from '../types'

// --- Конфигурация ---

const AREA_ICONS = {
  revit: Zap,
  ws: CheckCircle,
  gratitude: Heart,
} as const

const AREA_STYLES = {
  revit: { color: 'var(--tag-orange-text)', bg: 'var(--tag-orange-bg)', accent: 'var(--orange-500)' },
  ws: { color: 'var(--apex-info-text)', bg: 'rgba(var(--apex-info-rgb), 0.08)', accent: 'var(--apex-info-text)' },
  gratitude: { color: 'var(--tag-purple-text)', bg: 'var(--tag-purple-bg)', accent: 'var(--tag-purple-text)' },
} as const

// Названия достижений по рейтингу
const RANKING_ACHIEVEMENT_NAMES: Record<string, Record<AchievementEntityType, string>> = {
  revit: {
    user: 'Лидер автоматизации',
    team: 'Технологичная команда',
    department: 'Цифровой авангард',
  },
  ws: {
    user: 'Эталонная дисциплина',
    team: 'Эффективное управление',
    department: 'Образцовый отдел',
  },
}

const RANKING_EMOJIS: Record<string, Record<AchievementEntityType, string>> = {
  revit: { user: '⚡', team: '🛡️', department: '👑' },
  ws: { user: '📋', team: '🛡️', department: '👑' },
}

const RANKING_RULES: Record<string, Record<AchievementEntityType, string>> = {
  revit: {
    user: 'Продержитесь 10 дней в Топ-10 Revit на главной',
    team: 'Команда должна 10 дней быть в Топ-5 Revit на главной',
    department: 'Отдел должен 10 дней быть в Топ-5 Revit на главной',
  },
  ws: {
    user: 'Продержитесь 10 дней в Топ-10 Worksection на главной',
    team: 'Команда должна 10 дней быть в Топ-5 Worksection на главной',
    department: 'Отдел должен 10 дней быть в Топ-5 Worksection на главной',
  },
}

const GRATITUDE_NAMES: Record<string, string> = {
  help: 'Поддержка коллег',
  quality: 'Профессиональное признание',
  mentoring: 'Наставничество',
}

const GRATITUDE_EMOJIS: Record<string, string> = {
  help: '🤝',
  quality: '⭐',
  mentoring: '📚',
}

// --- Строка достижения по рейтингу ---

function RankingRow({
  name,
  emoji,
  entityLabel,
  groupName,
  progress,
  threshold,
  currentRank,
  earned,
  bonus,
  rule,
  color,
  daysElapsed,
  periodDays,
}: {
  name: string
  emoji: string
  entityLabel: string
  groupName?: string
  progress: number
  threshold: number
  currentRank: number | null
  earned: boolean
  bonus: number
  rule: string
  color: string
  daysElapsed: number
  periodDays: number
}) {
  const [showTip, setShowTip] = useState(false)
  const pct = threshold > 0 ? Math.min((progress / threshold) * 100, 100) : 0
  const remaining = threshold - progress

  return (
    <div className="py-2.5">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-sm">{emoji}</span>
          <span
            className="text-[12px] font-bold cursor-help relative"
            style={{ color: earned ? 'var(--apex-success-text)' : 'var(--text-primary)' }}
            onMouseEnter={() => setShowTip(true)}
            onMouseLeave={() => setShowTip(false)}
          >
            {name}
            {showTip && (
              <div
                className="absolute bottom-full left-0 mb-1.5 px-3 py-2 rounded-xl text-[11px] font-medium w-60 pointer-events-none"
                style={{ zIndex: 100, background: 'var(--surface-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              >
                <div className="font-bold mb-1">{name}</div>
                <div className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{rule}</div>
                <div className="text-[10px] font-semibold mt-1" style={{ color }}>Награда: +{bonus} ПК</div>
                <div className="absolute top-full left-4 w-2 h-2 rotate-45" style={{ background: 'var(--surface-elevated)', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }} />
              </div>
            )}
          </span>
          <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
            {groupName ?? entityLabel}
          </span>
          {currentRank !== null && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md" style={{ background: 'var(--surface)', color: 'var(--text-muted)' }}>
              #{currentRank}
            </span>
          )}
        </div>
        <span className="text-[12px] font-bold" style={{ color: earned ? 'var(--apex-success-text)' : 'var(--text-secondary)' }}>
          {progress}/{threshold}
        </span>
      </div>

      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface)' }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: earned ? 'var(--apex-primary)' : color, minWidth: progress > 0 ? '3px' : '0' }} />
      </div>

      <div className="flex items-center justify-between mt-0.5">
        <span className="text-[9px] font-medium" style={{ color: 'var(--text-muted)' }}>
          {earned ? `Получено! +${bonus} ПК` : remaining > 0 ? `ещё ${remaining} дней` : ''}
        </span>
        <span className="text-[9px] font-medium" style={{ color: 'var(--text-muted)' }}>
          {daysElapsed}/{periodDays}
        </span>
      </div>
    </div>
  )
}

// --- Строка достижения по благодарностям ---

function GratitudeRow({ item }: { item: GratitudeAchProgress }) {
  const [showTip, setShowTip] = useState(false)
  const emoji = GRATITUDE_EMOJIS[item.category] ?? '💬'
  const pct = item.threshold > 0 ? Math.min((item.current_count / item.threshold) * 100, 100) : 0
  const remaining = item.threshold - item.current_count

  return (
    <div className="py-2.5">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-sm">{emoji}</span>
          <span
            className="text-[12px] font-bold cursor-help relative"
            style={{ color: item.earned ? 'var(--apex-success-text)' : 'var(--text-primary)' }}
            onMouseEnter={() => setShowTip(true)}
            onMouseLeave={() => setShowTip(false)}
          >
            {item.achievement_name}
            {showTip && (
              <div
                className="absolute bottom-full left-0 mb-1.5 px-3 py-2 rounded-xl text-[11px] font-medium w-60 pointer-events-none"
                style={{ zIndex: 100, background: 'var(--surface-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              >
                <div className="font-bold mb-1">{item.achievement_name}</div>
                <div className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                  Получите {item.threshold} подарков в этой категории за месяц. Считаются только подарки с коинами.
                </div>
                <div className="text-[10px] font-semibold mt-1" style={{ color: 'var(--tag-purple-text)' }}>Награда: +{item.bonus_coins} ПК</div>
                <div className="absolute top-full left-4 w-2 h-2 rotate-45" style={{ background: 'var(--surface-elevated)', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }} />
              </div>
            )}
          </span>
        </div>
        <span className="text-[12px] font-bold" style={{ color: item.earned ? 'var(--apex-success-text)' : 'var(--text-secondary)' }}>
          {item.current_count}/{item.threshold}
        </span>
      </div>

      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface)' }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: item.earned ? 'var(--apex-primary)' : 'var(--tag-purple-text)', minWidth: item.current_count > 0 ? '3px' : '0' }} />
      </div>

      <div className="flex items-center justify-between mt-0.5">
        <span className="text-[9px] font-medium" style={{ color: 'var(--text-muted)' }}>
          {item.earned ? `Получено! +${item.bonus_coins} ПК` : remaining > 0 ? `ещё ${remaining} подарков` : ''}
        </span>
      </div>
    </div>
  )
}

// --- Блок области (Revit / WS) ---

interface RankingBlockProps {
  area: 'revit' | 'ws'
  title: string
  personalProgress: AreaProgress | null
  teamProgress: AreaProgress | null
  deptProgress: AreaProgress | null
  teamName: string | null
  deptName: string | null
  daysElapsed: number
  periodDays: number
}

export function RankingBlock({
  area, title, personalProgress, teamProgress, deptProgress,
  teamName, deptName, daysElapsed, periodDays,
}: RankingBlockProps) {
  const style = AREA_STYLES[area]
  const Icon = AREA_ICONS[area]
  const names = RANKING_ACHIEVEMENT_NAMES[area]
  const emojis = RANKING_EMOJIS[area]
  const rules = RANKING_RULES[area]

  const rows: { entityType: AchievementEntityType; progress: AreaProgress; groupName?: string }[] = []

  const defaultProgress: AreaProgress = { area, days_in_top: 0, threshold: 10, current_rank: null, earned: false }
  rows.push({ entityType: 'user', progress: personalProgress ?? defaultProgress })
  rows.push({ entityType: 'team', progress: teamProgress ?? defaultProgress, groupName: teamName ?? undefined })
  rows.push({ entityType: 'department', progress: deptProgress ?? defaultProgress, groupName: deptName ?? undefined })

  return (
    <div
      className="rounded-2xl overflow-visible relative"
      style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
    >
      {/* Шапка */}
      <div className="flex items-center gap-2 px-5 pt-4 pb-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: style.bg }}>
          <Icon size={16} style={{ color: style.color }} />
        </div>
        <div>
          <div className="text-[13px] font-extrabold" style={{ color: 'var(--text-primary)' }}>{title}</div>
          <div className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>10 дней в топе за месяц</div>
        </div>
      </div>

      {/* Строки достижений */}
      <div className="px-5 pb-4 space-y-1">
        {rows.map((r) => (
          <RankingRow
            key={r.entityType}
            name={names[r.entityType]}
            emoji={emojis[r.entityType]}
            entityLabel={r.entityType === 'user' ? 'Личное' : r.entityType === 'team' ? 'Команда' : 'Отдел'}
            groupName={r.groupName}
            progress={r.progress.days_in_top}
            threshold={r.progress.threshold}
            currentRank={r.progress.current_rank}
            earned={r.progress.earned}
            bonus={ACHIEVEMENT_BONUSES[r.entityType]}
            rule={rules[r.entityType]}
            color={style.accent}
            daysElapsed={daysElapsed}
            periodDays={periodDays}
          />
        ))}
      </div>
    </div>
  )
}

// --- Блок благодарностей ---

interface GratitudeBlockProps {
  items: GratitudeAchProgress[]
}

export function GratitudeBlock({ items }: GratitudeBlockProps) {
  const style = AREA_STYLES.gratitude
  const Icon = AREA_ICONS.gratitude

  // Всегда показываем 3 категории
  const defaultItems: GratitudeAchProgress[] = [
    { category: 'help', achievement_name: 'Поддержка коллег', current_count: 0, threshold: 4, bonus_coins: 200, earned: false },
    { category: 'quality', achievement_name: 'Профессиональное признание', current_count: 0, threshold: 4, bonus_coins: 200, earned: false },
    { category: 'mentoring', achievement_name: 'Наставничество', current_count: 0, threshold: 4, bonus_coins: 200, earned: false },
  ]
  const displayItems = defaultItems.map((def) => {
    const real = items.find((i) => i.category === def.category)
    return real ?? def
  })

  return (
    <div
      className="rounded-2xl overflow-visible relative"
      style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
    >
      {/* Шапка */}
      <div className="flex items-center gap-2 px-5 pt-4 pb-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: style.bg }}>
          <Icon size={16} style={{ color: style.color }} />
        </div>
        <div>
          <div className="text-[13px] font-extrabold" style={{ color: 'var(--text-primary)' }}>Благодарности</div>
          <div className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>Подарки по категориям за месяц</div>
        </div>
      </div>

      {/* Строки достижений */}
      <div className="px-5 pb-4 space-y-1">
        {displayItems.map((item) => (
          <GratitudeRow key={item.category} item={item} />
        ))}
      </div>
    </div>
  )
}
