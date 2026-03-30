'use client'

import { useState, useMemo } from 'react'

import { CompanyAwardCard } from './CompanyAwardCard'
import { ACHIEVEMENT_AREAS } from '../types'
import type { CompanyAward, AchievementArea, AchievementEntityType } from '../types'

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

function getMonthLabel(periodStart: string): string {
  const [year, month] = periodStart.split('-').map(Number)
  return `${MONTH_NAMES[month - 1]} ${year}`
}

interface AwardsFiltersProps {
  awards: CompanyAward[]
}

export function AwardsFilters({ awards }: AwardsFiltersProps) {
  const [area, setArea] = useState<AchievementArea | 'all'>('all')
  const [entityType, setEntityType] = useState<AchievementEntityType | 'all'>('all')

  const filtered = useMemo(() => {
    let result = awards
    if (area !== 'all') result = result.filter((a) => a.area === area)
    if (entityType !== 'all') result = result.filter((a) => a.entity_type === entityType)
    return result
  }, [awards, area, entityType])

  // Группировка по месяцам
  const grouped = useMemo(() => {
    const map = new Map<string, CompanyAward[]>()
    for (const a of filtered) {
      const key = a.period_start.slice(0, 7)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(a)
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [filtered])

  const areaFilters: { value: AchievementArea | 'all'; label: string }[] = [
    { value: 'all', label: 'Все области' },
    ...ACHIEVEMENT_AREAS.map((a) => ({ value: a.area, label: a.label })),
  ]

  const entityFilters: { value: AchievementEntityType | 'all'; label: string }[] = [
    { value: 'all', label: 'Все уровни' },
    { value: 'user', label: 'Личные' },
    { value: 'team', label: 'Командные' },
    { value: 'department', label: 'Отдельские' },
  ]

  return (
    <div className="space-y-5 animate-fade-in-up stagger-1">
      {/* Фильтры */}
      <div className="flex flex-wrap gap-2">
        {areaFilters.map((f) => (
          <button
            key={f.value}
            onClick={() => setArea(f.value)}
            className="px-3 py-1.5 rounded-full text-[12px] font-bold transition-all"
            style={{
              background: area === f.value ? 'var(--apex-success-bg)' : 'var(--surface-elevated)',
              color: area === f.value ? 'var(--apex-success-text)' : 'var(--text-muted)',
              border: area === f.value ? '1px solid var(--teal-100)' : '1px solid var(--border)',
            }}
          >
            {f.label}
          </button>
        ))}

        <div className="w-px mx-1" style={{ background: 'var(--border)' }} />

        {entityFilters.map((f) => (
          <button
            key={f.value}
            onClick={() => setEntityType(f.value)}
            className="px-3 py-1.5 rounded-full text-[12px] font-bold transition-all"
            style={{
              background: entityType === f.value ? 'var(--apex-success-bg)' : 'var(--surface-elevated)',
              color: entityType === f.value ? 'var(--apex-success-text)' : 'var(--text-muted)',
              border: entityType === f.value ? '1px solid var(--teal-100)' : '1px solid var(--border)',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Результаты */}
      {grouped.length === 0 ? (
        <div
          className="rounded-2xl py-12 text-center"
          style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
        >
          <div className="text-3xl mb-3">🏆</div>
          <div className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>
            Нет достижений
          </div>
          <div className="text-[12px] font-medium mt-1" style={{ color: 'var(--text-muted)' }}>
            Достижения появятся здесь, когда кто-то проведёт достаточно дней в топе
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([monthKey, monthAwards]) => (
            <div key={monthKey}>
              <div
                className="text-[12px] font-bold uppercase tracking-wider mb-3 capitalize"
                style={{ color: 'var(--text-muted)' }}
              >
                {getMonthLabel(monthAwards[0].period_start)}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {monthAwards.map((award) => (
                  <CompanyAwardCard key={award.id} award={award} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
