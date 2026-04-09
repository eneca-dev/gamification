'use client'

import { useState } from 'react'
import { Zap, CheckCircle, Heart, Trophy, Users, Building2, ChevronRight, X } from 'lucide-react'
import { CoinIcon } from '@/components/CoinIcon'

import type { AchievementAward, AchievementEntityType, AchievementArea } from '../types'
import { ACHIEVEMENT_BONUSES } from '../types'

const AREA_CONFIG = {
  revit: { label: 'Revit', icon: Zap, color: 'var(--tag-orange-text)', bg: 'var(--tag-orange-bg)', emoji: '⚡' },
  ws: { label: 'Worksection', icon: CheckCircle, color: 'var(--apex-primary)', bg: 'var(--apex-success-bg)', emoji: '📋' },
  gratitude: { label: 'Благодарности', icon: Trophy, color: 'var(--tag-purple-text)', bg: 'var(--tag-purple-bg)', emoji: '💜' },
} as const

const ENTITY_CONFIG: Record<AchievementEntityType, { icon: typeof Trophy; label: string; emoji: string }> = {
  user: { icon: Trophy, label: 'Личное', emoji: '🏆' },
  team: { icon: Users, label: 'Команда', emoji: '🛡️' },
  department: { icon: Building2, label: 'Отдел', emoji: '👑' },
}

const MONTH_NAMES = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']
const MONTH_NAMES_FULL = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']

// Получить месяцы текущего квартала
function getQuarterMonths(): { month: number; year: number; label: string }[] {
  const now = new Date()
  const q = Math.floor(now.getMonth() / 3)
  const startMonth = q * 3
  return [0, 1, 2].map((offset) => ({
    month: startMonth + offset,
    year: now.getFullYear(),
    label: MONTH_NAMES[startMonth + offset],
  }))
}

function periodToMonthIndex(periodStart: string): { month: number; year: number } {
  const [year, month] = periodStart.split('-').map(Number)
  return { month: month - 1, year }
}

// Одна ячейка кубка
function TrophyCell({
  month,
  year,
  label,
  area,
  entityType,
  award,
  isCurrent,
  isFuture,
}: {
  month: number
  year: number
  label: string
  area: AchievementArea
  entityType: AchievementEntityType
  award: AchievementAward | null
  isCurrent: boolean
  isFuture: boolean
}) {
  const [showTooltip, setShowTooltip] = useState(false)
  const areaCfg = AREA_CONFIG[area]
  const entityCfg = ENTITY_CONFIG[entityType]
  const earned = award !== null
  const bonus = ACHIEVEMENT_BONUSES[entityType]

  return (
    <div
      className="relative group"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div
        className="w-full rounded-xl flex flex-col items-center justify-center gap-1 py-4 transition-all cursor-default"
        style={{
          background: earned
            ? areaCfg.bg
            : isCurrent
              ? 'var(--surface)'
              : 'var(--surface)',
          border: earned
            ? `2px solid ${areaCfg.color}`
            : isCurrent
              ? '2px dashed var(--border)'
              : '1px solid var(--border)',
          opacity: isFuture ? 0.4 : earned ? 1 : 0.5,
        }}
      >
        <span className="text-3xl" style={{ filter: earned ? 'none' : 'grayscale(1) opacity(0.4)' }}>
          {entityCfg.emoji}
        </span>
        <span
          className="text-[10px] font-bold"
          style={{ color: earned ? areaCfg.color : 'var(--text-muted)' }}
        >
          {label}
        </span>
      </div>

      {/* Tooltip */}
      {showTooltip && !isFuture && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-xl text-[11px] w-48 z-50 pointer-events-none"
          style={{
            background: 'var(--surface-elevated)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          }}
        >
          <div className="font-bold">{MONTH_NAMES_FULL[month]} {year}</div>
          <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {areaCfg.label} — {entityCfg.label}
          </div>
          {earned ? (
            <div className="text-[10px] mt-1 space-y-0.5" style={{ color: 'var(--text-secondary)' }}>
              <div>Дней в топе: {award.days_in_top}</div>
              <div className="font-semibold inline-flex items-center gap-0.5" style={{ color: areaCfg.color }}>Награда: +{bonus} <CoinIcon size={10} /></div>
            </div>
          ) : isCurrent ? (
            <div className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>В процессе...</div>
          ) : (
            <div className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>Не получено</div>
          )}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 rotate-45" style={{ background: 'var(--surface-elevated)', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }} />
        </div>
      )}
    </div>
  )
}

// Модалка "Все достижения"
function AllAwardsModal({ awards, onClose }: { awards: AchievementAward[]; onClose: () => void }) {
  // Группируем по месяцам
  const grouped = new Map<string, AchievementAward[]>()
  for (const a of awards) {
    const key = a.period_start.slice(0, 7) // "2026-03"
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(a)
  }
  const months = [...grouped.entries()].sort((a, b) => b[0].localeCompare(a[0]))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.15)', backdropFilter: 'blur(2px)' }}>
      <div
        className="rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto"
        style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-extrabold" style={{ color: 'var(--text-primary)' }}>Все достижения</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--surface)] transition-colors">
            <X size={18} style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>

        {months.length === 0 ? (
          <div className="text-center py-8 text-[13px] font-medium" style={{ color: 'var(--text-muted)' }}>
            Пока нет достижений
          </div>
        ) : (
          <div className="space-y-5">
            {months.map(([monthKey, monthAwards]) => {
              const d = new Date(monthKey + '-01')
              const monthLabel = d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })

              return (
                <div key={monthKey}>
                  <div className="text-[11px] font-bold uppercase tracking-wider mb-2 capitalize" style={{ color: 'var(--text-muted)' }}>
                    {monthLabel}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {monthAwards.map((award) => {
                      const areaCfg = AREA_CONFIG[award.area]
                      const entityCfg = ENTITY_CONFIG[award.entity_type]
                      const bonus = ACHIEVEMENT_BONUSES[award.entity_type]

                      return (
                        <div
                          key={`${award.entity_type}-${award.area}-${award.period_start}`}
                          className="rounded-xl p-3 flex flex-col items-center gap-1"
                          style={{ background: areaCfg.bg, border: `1px solid ${areaCfg.color}33` }}
                        >
                          <span className="text-2xl">{entityCfg.emoji}</span>
                          <span className="text-[11px] font-bold text-center" style={{ color: areaCfg.color }}>
                            {entityCfg.label}
                          </span>
                          <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                            {areaCfg.label}
                          </span>
                          <span className="text-[10px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                            <span className="inline-flex items-center gap-0.5">{award.days_in_top} дней &middot; +{bonus} <CoinIcon size={10} /></span>
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

// Основной компонент
interface TrophyShelfProps {
  awards: AchievementAward[]
}

export function TrophyShelf({ awards }: TrophyShelfProps) {
  const [showAll, setShowAll] = useState(false)
  const quarterMonths = getQuarterMonths()
  const areas: AchievementArea[] = ['revit', 'ws']
  const entityTypes: AchievementEntityType[] = ['user', 'team', 'department']
  const gratitudeCategories = [
    { area: 'gratitude_help', label: 'Поддержка коллег', emoji: '🤝', color: 'var(--apex-primary)', bg: 'var(--apex-success-bg)' },
    { area: 'gratitude_quality', label: 'Проф. признание', emoji: '⭐', color: 'var(--tag-orange-text)', bg: 'var(--tag-orange-bg)' },
    { area: 'gratitude_mentoring', label: 'Наставничество', emoji: '📚', color: 'var(--tag-purple-text)', bg: 'var(--tag-purple-bg)' },
  ]

  const quarterLabel = `Q${Math.floor(new Date().getMonth() / 3) + 1} ${new Date().getFullYear()}`

  return (
    <>
      <div
        className="rounded-2xl p-5"
        data-onboarding="trophy-shelf"
        style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Trophy size={14} style={{ color: 'var(--orange-500)' }} />
            <div className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Кубки за {quarterLabel}
            </div>
          </div>
          <button
            onClick={() => setShowAll(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors hover:opacity-80"
            style={{ background: 'var(--surface)', color: 'var(--text-muted)' }}
          >
            Все достижения
            <ChevronRight size={12} />
          </button>
        </div>

        <div className="space-y-5">
          {areas.map((area) => {
            const areaCfg = AREA_CONFIG[area]
            const Icon = areaCfg.icon

            return (
              <div key={area}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Icon size={12} style={{ color: areaCfg.color }} />
                  <span className="text-[11px] font-bold" style={{ color: areaCfg.color }}>{areaCfg.label}</span>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {entityTypes.map((et) => {
                    const entityCfg = ENTITY_CONFIG[et]
                    const now = new Date()
                    const currentMonth = now.getMonth()
                    const currentYear = now.getFullYear()

                    return (
                      <div key={et}>
                        <div className="text-[10px] font-semibold mb-1.5 text-center" style={{ color: 'var(--text-muted)' }}>
                          {entityCfg.label}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {quarterMonths.map((qm) => {
                            const award = awards.find((a) => {
                              const p = periodToMonthIndex(a.period_start)
                              return p.month === qm.month && p.year === qm.year && a.area === area && a.entity_type === et
                            }) ?? null
                            const isCurrent = qm.month === currentMonth && qm.year === currentYear
                            const isFuture = qm.year > currentYear || (qm.year === currentYear && qm.month > currentMonth)

                            return (
                              <TrophyCell
                                key={`${qm.month}-${qm.year}`}
                                month={qm.month}
                                year={qm.year}
                                label={qm.label}
                                area={area}
                                entityType={et}
                                award={award}
                                isCurrent={isCurrent}
                                isFuture={isFuture}
                              />
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
          {/* Благодарности — только личные, 3 категории */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Heart size={12} style={{ color: 'var(--tag-purple-text)' }} />
              <span className="text-[11px] font-bold" style={{ color: 'var(--tag-purple-text)' }}>Благодарности</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {gratitudeCategories.map((gc) => {
                const now = new Date()
                const currentMonth = now.getMonth()
                const currentYear = now.getFullYear()

                return (
                  <div key={gc.area}>
                    <div className="text-[10px] font-semibold mb-1.5 text-center" style={{ color: 'var(--text-muted)' }}>
                      {gc.label}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {quarterMonths.map((qm) => {
                        const award = awards.find((a) => {
                          const p = periodToMonthIndex(a.period_start)
                          return p.month === qm.month && p.year === qm.year && a.area === gc.area && a.entity_type === 'user'
                        }) ?? null
                        const isCurrent = qm.month === currentMonth && qm.year === currentYear
                        const isFuture = qm.year > currentYear || (qm.year === currentYear && qm.month > currentMonth)

                        return (
                          <TrophyCell
                            key={`${qm.month}-${qm.year}`}
                            month={qm.month}
                            year={qm.year}
                            label={qm.label}
                            area={'gratitude' as AchievementArea}
                            entityType="user"
                            award={award}
                            isCurrent={isCurrent}
                            isFuture={isFuture}
                          />
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {showAll && <AllAwardsModal awards={awards} onClose={() => setShowAll(false)} />}
    </>
  )
}
