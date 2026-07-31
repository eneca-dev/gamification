'use client'

import { useState } from 'react'
import { Zap, CheckCircle, Heart, Trophy, Users, Building2 } from 'lucide-react'
import { CoinIcon } from '@/components/CoinIcon'

import type { AreaProgress, AchievementEntityType, AchievementArea, GratitudeAchProgress } from '../types'
import { ACHIEVEMENT_BONUSES } from '../types'

const GRATITUDE_CAT_CONFIG: Record<string, { emoji: string; label: string; color: string; bg: string }> = {
  help: { emoji: '🤝', label: 'Надёжное плечо', color: 'var(--apex-primary)', bg: 'var(--apex-success-bg)' },
  quality: { emoji: '⭐', label: 'Эксперт', color: 'var(--tag-orange-text)', bg: 'var(--tag-orange-bg)' },
  mentoring: { emoji: '📚', label: 'Наставник', color: 'var(--tag-purple-text)', bg: 'var(--tag-purple-bg)' },
}

const AREA_CONFIG = {
  revit: { label: 'Revit', icon: Zap, color: 'var(--tag-orange-text)', bg: 'var(--tag-orange-bg)' },
  ws: { label: 'Worksection', icon: CheckCircle, color: 'var(--apex-info-text)', bg: 'rgba(var(--apex-info-rgb), 0.08)' },
  gratitude: { label: 'Благодарности', icon: Heart, color: 'var(--tag-purple-text)', bg: 'var(--tag-purple-bg)' },
} as const

const AREA_RULES: Record<AchievementArea, Record<AchievementEntityType, string>> = {
  revit: {
    // user: см. buildRevitUserRule() ниже — правило зависит от того, подключено ли
    // второе условие (топ по запускам), поэтому не статичная строка.
    user: 'Попадите в топ-10 сотрудников по Revit-💎 и продержитесь {threshold} дней за месяц. 💎 = 💎 за использование плагинов + стрик-бонусы.',
    team: 'Ваша команда должна попасть в топ-5 команд по Revit и продержаться 10 дней. Формула: 💎 команды с учётом вовлечённости.',
    department: 'Ваш отдел должен попасть в топ-5 отделов по Revit и продержаться 10 дней. Формула: 💎 отдела с учётом вовлечённости.',
  },
  ws: {
    user: 'Попадите в топ-10 сотрудников по WS-💎 и продержитесь 10 дней за месяц. 💎 = 💎 за зелёные дни, стрики и бюджет.',
    team: 'Ваша команда должна попасть в топ-5 команд по WS и продержаться 10 дней. Формула: 💎 команды с учётом вовлечённости.',
    department: 'Ваш отдел должен попасть в топ-5 отделов по WS и продержаться 10 дней. Формула: 💎 отдела с учётом вовлечённости.',
  },
  gratitude: {
    user: 'Попадите в топ-10 по полученным благодарностям и продержитесь 10 дней за месяц.',
    team: 'Ваша команда должна попасть в топ-5 по благодарностям и продержаться 10 дней.',
    department: 'Ваш отдел должен попасть в топ-5 по благодарностям и продержаться 10 дней.',
  },
}

// Правило для revit/user зависит от того, подключено ли второе условие (топ по
// запускам). Сигнал — присутствует ли поле current_rank_launches вообще
// (undefined = бэкенд ещё не отдаёт), а не его значение (null — нормальное
// состояние "сейчас нет ранга по запускам", а не "фичи нет").
function buildRule(item: AreaProgress, entityType: AchievementEntityType): string {
  if (item.area === 'revit' && entityType === 'user') {
    const base = `Попадите в топ-10 сотрудников по Revit-💎 и продержитесь ${item.threshold} дней за месяц.`
    return item.current_rank_launches === undefined
      ? `${base} 💎 = 💎 за использование плагинов + стрик-бонусы.`
      : `${base} Нужно одновременно быть и в топ-10 по 💎, и в топ-10 по количеству запусков плагинов.`
  }
  return AREA_RULES[item.area][entityType].replace('{threshold}', String(item.threshold))
}

// Объясняет, почему вчерашний день не засчитался (только revit/user, только когда
// фича с запусками уже подключена). Топ-10 — фиксированная отсечка в БД (v_top_personal).
function buildMissReason(item: AreaProgress, entityType: AchievementEntityType): string | null {
  if (item.area !== 'revit' || entityType !== 'user' || item.earned || item.current_rank_launches === undefined) return null
  if (item.current_rank === null && item.current_rank_launches === null) return null // нет вообще никакой активности — не в чем "не дотянуть"

  const missedCoins = item.current_rank === null || item.current_rank > 10
  const missedLaunches = item.current_rank_launches === null || item.current_rank_launches > 10
  if (!missedCoins && !missedLaunches) return null

  const rankLabel = (r: number | null) => (r === null ? 'не в топе' : `#${r}`)

  if (missedCoins && missedLaunches) {
    return `Вчера не хватило по обоим условиям: ${rankLabel(item.current_rank)} по 💎, ${rankLabel(item.current_rank_launches ?? null)} по запускам (нужно ≤10 по обоим).`
  }
  if (missedCoins) {
    return `Вчера не хватило места по 💎: ${rankLabel(item.current_rank)} (нужно ≤10). По запускам всё ок — ${rankLabel(item.current_rank_launches ?? null)}.`
  }
  return `Вчера не хватило места по запускам: ${rankLabel(item.current_rank_launches ?? null)} (нужно ≤10). По 💎 всё ок — ${rankLabel(item.current_rank)}.`
}

const SCOPE_CONFIG: Record<AchievementEntityType, { icon: typeof Trophy; label: string }> = {
  user: { icon: Trophy, label: 'Личное' },
  team: { icon: Users, label: 'Команда' },
  department: { icon: Building2, label: 'Отдел' },
}

interface ProgressCardProps {
  entityType: AchievementEntityType
  groupLabel?: string
  items: AreaProgress[]
  daysElapsed: number
  periodDays: number
  gratitudeProgress?: GratitudeAchProgress[]
}

export function ProgressCard({ entityType, groupLabel, items, daysElapsed, periodDays, gratitudeProgress }: ProgressCardProps) {
  const scope = SCOPE_CONFIG[entityType]
  const ScopeIcon = scope.icon

  // Всегда показываем Revit и WS (даже если 0/10)
  const DEFAULT_AREAS: AreaProgress[] = [
    { area: 'revit', days_in_top: 0, threshold: 10, current_rank: null, earned: false },
    { area: 'ws', days_in_top: 0, threshold: 10, current_rank: null, earned: false },
  ]
  const displayItems = DEFAULT_AREAS.map((def) => {
    const real = items.find((i) => i.area === def.area)
    return real ?? def
  })

  return (
    <div
      className="rounded-2xl p-5 overflow-visible relative"
      style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', zIndex: 1 }}
    >
      <div className="flex items-center gap-2 mb-4">
        <ScopeIcon size={16} style={{ color: 'var(--text-muted)' }} />
        <div className="text-[12px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          {groupLabel ?? scope.label}
        </div>
      </div>

      <div className="space-y-4">
        {displayItems.map((item) => (
          <AreaRow
            key={item.area}
            item={item}
            entityType={entityType}
            daysElapsed={daysElapsed}
            periodDays={periodDays}
          />
        ))}

        {/* Благодарности — только для личного */}
        {entityType === 'user' && gratitudeProgress && gratitudeProgress.map((gp, index) => {
          const catCfg = GRATITUDE_CAT_CONFIG[gp.category]
          if (!catCfg) return null
          return (
            <GratitudeRow
              key={gp.category}
              item={gp}
              cfg={catCfg}
              isFirst={index === 0}
            />
          )
        })}
      </div>
    </div>
  )
}

function AreaRow({ item, entityType, daysElapsed, periodDays }: {
  item: AreaProgress
  entityType: AchievementEntityType
  daysElapsed: number
  periodDays: number
}) {
  const [showTip, setShowTip] = useState(false)
  const cfg = AREA_CONFIG[item.area]
  const Icon = cfg.icon
  const pct = Math.min((item.days_in_top / item.threshold) * 100, 100)
  const remaining = Math.max(item.threshold - item.days_in_top, 0)
  const bonus = ACHIEVEMENT_BONUSES[entityType]
  const rule = buildRule(item, entityType)
  const missReason = buildMissReason(item, entityType)

  return (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold cursor-help relative"
                      style={{ color: cfg.color, background: cfg.bg }}
                      onMouseEnter={() => setShowTip(true)}
                      onMouseLeave={() => setShowTip(false)}
                    >
                      <Icon size={12} />
                      {cfg.label}
                      {showTip && (
                        <div
                          className="absolute bottom-full left-0 mb-1.5 px-3 py-2 rounded-xl text-[11px] font-medium w-64 pointer-events-none"
                          style={{
                            zIndex: 100,
                            background: 'var(--surface-elevated)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border)',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                          }}
                        >
                          <div className="font-bold mb-1">Как получить достижение</div>
                          <div className="text-[10px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                            {rule}
                          </div>
                          {missReason && (
                            <div className="text-[10px] leading-relaxed mt-1" style={{ color: 'var(--apex-danger, #e05252)' }}>
                              {missReason}
                            </div>
                          )}
                          <div className="text-[10px] font-semibold mt-1 inline-flex items-center gap-0.5" style={{ color: cfg.color }}>
                            Награда: +{bonus} <CoinIcon size={10} />
                          </div>
                          <div
                            className="absolute top-full left-4 w-2 h-2 rotate-45"
                            style={{ background: 'var(--surface-elevated)', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}
                          />
                        </div>
                      )}
                    </span>
                    {item.current_rank && (
                      <span className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                        #{item.current_rank}
                      </span>
                    )}
                    {item.current_rank_launches != null && (
                      <span className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                        · по запускам #{item.current_rank_launches}
                      </span>
                    )}
                  </div>
                  <span className="text-[12px] font-bold" style={{ color: item.earned ? 'var(--apex-success-text)' : 'var(--text-secondary)' }}>
                    {item.days_in_top}/{item.threshold} дней
                  </span>
                </div>

                {/* Прогресс-бар */}
                <div
                  className="h-2 rounded-full overflow-hidden"
                  style={{ background: 'var(--surface)' }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      background: item.earned
                        ? 'var(--apex-primary)'
                        : `linear-gradient(90deg, ${cfg.color}, ${cfg.color}88)`,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] font-medium inline-flex items-center gap-0.5" style={{ color: 'var(--text-muted)' }}>
                    {item.earned
                      ? <>Получено! +{bonus} <CoinIcon size={10} /></>
                      : remaining > 0
                        ? `Осталось ${remaining} дней в топе`
                        : ''
                    }
                  </span>
                  <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                    День {daysElapsed}/{periodDays}
                  </span>
                </div>
              </div>
  )
}

function GratitudeRow({ item, cfg, isFirst }: {
  item: GratitudeAchProgress
  cfg: { emoji: string; label: string; color: string; bg: string }
  isFirst?: boolean
}) {
  const [showTip, setShowTip] = useState(false)
  const pct = Math.min((item.current_count / item.threshold) * 100, 100)
  const remaining = Math.max(item.threshold - item.current_count, 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold cursor-help relative"
            style={{ color: cfg.color, background: cfg.bg }}
            onMouseEnter={() => setShowTip(true)}
            onMouseLeave={() => setShowTip(false)}
          >
            <span className="text-sm">{cfg.emoji}</span>
            {cfg.label}
            {showTip && (
              <div
                className={`absolute left-0 px-3 py-2 rounded-xl text-[11px] font-medium w-72 pointer-events-none ${isFirst ? 'top-full mt-1.5' : 'bottom-full mb-1.5'}`}
                style={{ zIndex: 100, background: 'var(--surface-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              >
                {isFirst
                  ? <div className="absolute -top-1 left-4 w-2 h-2 rotate-45" style={{ background: 'var(--surface-elevated)', borderLeft: '1px solid var(--border)', borderTop: '1px solid var(--border)' }} />
                  : <div className="absolute top-full left-4 w-2 h-2 rotate-45" style={{ background: 'var(--surface-elevated)', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }} />
                }
                <div className="font-bold mb-1">{item.achievement_name}</div>
                <div className="text-[10px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Получите {item.threshold} подарка в категории &laquo;{cfg.label}&raquo; за месяц. Считаются только платные подарки.
                </div>
                <div className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                  Первое выполненное достижение среди трёх категорий приносит{' '}
                  <span className="inline-flex items-center gap-0.5 align-middle">200 <CoinIcon size={9} /></span>.
                  {' '}За остальные — только значок 🌟 без <span className="inline-flex items-center align-middle"><CoinIcon size={9} /></span>.
                </div>
              </div>
            )}
          </span>
        </div>
        <span className="text-[12px] font-bold" style={{ color: item.earned ? 'var(--apex-success-text)' : 'var(--text-secondary)' }}>
          {item.current_count}/{item.threshold}
        </span>
      </div>

      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: item.earned ? 'var(--apex-primary)' : `linear-gradient(90deg, ${cfg.color}, ${cfg.color}88)`,
            minWidth: item.current_count > 0 ? '4px' : '0px',
          }}
        />
      </div>

      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] font-medium inline-flex items-center gap-0.5" style={{ color: 'var(--text-muted)' }}>
          {item.earned
            ? (item.earned_with_coins ?? true)
              ? <>Получено! +{item.bonus_coins} <CoinIcon size={10} /></>
              : <>🌟 Ты молодец!</>
            : remaining > 0
              ? (item.coins_available ?? true)
                ? `Осталось ${remaining} подарков`
                : `Осталось ${remaining} подарков · без монет`
              : ''
          }
        </span>
      </div>
    </div>
  )
}
