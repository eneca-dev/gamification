'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import type { AppealCalendarDay } from '@/modules/feedback/index.client'

interface AppealDateGridProps {
  days: AppealCalendarDay[]
  selected: Set<string>
  onToggle: (date: string) => void
}

// Константы визуала повторяют StreakPanel (CELL=18, GAP=3)
const CELL = 18
const CELL_GAP = 3
const DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

const statusColors: Record<AppealCalendarDay['status'], string> = {
  green: 'var(--apex-primary)',
  red: 'var(--apex-danger)',
  absent: 'var(--apex-info-text)',
  none: 'transparent',
}

const statusLabels: Record<AppealCalendarDay['status'], string> = {
  green: 'Зелёный',
  red: 'Красный',
  absent: 'Отпуск / Выходной',
  none: 'Выходной',
}

const absenceLabels: Record<string, string> = {
  vacation: 'Отпуск',
  sick_leave: 'Больничный',
  sick_day: 'SickDay',
  day_off: 'Выходной',
  business_trip: 'Выходной',
}

interface MonthGrid {
  key: string
  name: string
  weeks: (AppealCalendarDay | null)[][]
}

function buildMonthGrids(days: AppealCalendarDay[]): MonthGrid[] {
  const byMonth = new Map<string, AppealCalendarDay[]>()
  for (const day of days) {
    const m = day.date.slice(0, 7)
    const arr = byMonth.get(m) ?? []
    arr.push(day)
    byMonth.set(m, arr)
  }

  return [...byMonth.keys()].sort().map((key) => {
    const list = byMonth.get(key)!
    const first = new Date(list[0].date + 'T00:00:00')
    const firstDow = (first.getDay() + 6) % 7

    const padded: (AppealCalendarDay | null)[] = []
    for (let i = 0; i < firstDow; i++) padded.push(null)
    for (const day of list) padded.push(day)
    while (padded.length % 7 !== 0) padded.push(null)

    const weeks: (AppealCalendarDay | null)[][] = []
    for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7))

    const raw = new Date(key + '-15').toLocaleString('ru-RU', { month: 'long', year: 'numeric' })
    return {
      key,
      name: raw.charAt(0).toUpperCase() + raw.slice(1),
      weeks,
    }
  })
}

function formatDate(date: string): string {
  const [y, m, d] = date.split('-')
  return `${d}.${m}.${y}`
}

function getTooltip(day: AppealCalendarDay): string {
  const dateLabel = formatDate(day.date)
  if (day.status === 'absent' && day.absence_type) {
    return `${dateLabel}: ${absenceLabels[day.absence_type] ?? day.absence_type}`
  }
  let text = `${dateLabel}: ${statusLabels[day.status]}`
  if (day.negative_coins < 0) {
    text += `\nСписание: ${day.negative_coins.toLocaleString('ru-RU')} 💎`
  }
  return text
}

function isClickable(day: AppealCalendarDay): boolean {
  // Разрешаем выбор любого дня со статусом (кроме пустых выходных):
  // пользователь может хотеть обжаловать и зелёный день — например, не согласен
  // с суммой или спорит по бонусу за плагин
  return day.status !== 'none'
}

export function AppealDateGrid({ days, selected, onToggle }: AppealDateGridProps) {
  const months = useMemo(() => buildMonthGrids(days), [days])
  // По умолчанию показываем самый последний (текущий) месяц
  const [monthIdx, setMonthIdx] = useState(() => Math.max(0, months.length - 1))

  const safeIdx = Math.min(Math.max(0, monthIdx), months.length - 1)
  const month = months[safeIdx]
  const canPrev = safeIdx > 0
  const canNext = safeIdx < months.length - 1

  if (!month) {
    return (
      <p className="text-xs text-center py-6" style={{ color: 'var(--apex-text-muted)' }}>
        Нет данных
      </p>
    )
  }

  return (
    <div className="flex flex-col">
      {/* Шапка: стрелки + название месяца */}
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => canPrev && setMonthIdx(safeIdx - 1)}
          disabled={!canPrev}
          className="w-6 h-6 inline-flex items-center justify-center rounded-md transition-colors disabled:opacity-30"
          style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)', color: 'var(--apex-text-secondary)' }}
          aria-label="Предыдущий месяц"
        >
          <ChevronLeft size={12} />
        </button>
        <span
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--apex-text)' }}
        >
          {month.name}
        </span>
        <button
          type="button"
          onClick={() => canNext && setMonthIdx(safeIdx + 1)}
          disabled={!canNext}
          className="w-6 h-6 inline-flex items-center justify-center rounded-md transition-colors disabled:opacity-30"
          style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)', color: 'var(--apex-text-secondary)' }}
          aria-label="Следующий месяц"
        >
          <ChevronRight size={12} />
        </button>
      </div>

      {/* Один месяц */}
      <div className="flex flex-col items-center">
        <div className="flex mb-1" style={{ gap: CELL_GAP }}>
          {DAY_LABELS.map((label) => (
            <div
              key={label}
              className="text-[9px] font-medium text-center"
              style={{ width: CELL, color: 'var(--apex-text-muted)' }}
            >
              {label}
            </div>
          ))}
        </div>
        <div className="flex flex-col" style={{ gap: CELL_GAP }}>
          {month.weeks.map((week, wIdx) => (
            <div key={wIdx} className="flex" style={{ gap: CELL_GAP }}>
              {week.map((day, dIdx) => {
                if (!day) {
                  return (
                    <div
                      key={`empty-${dIdx}`}
                      style={{ width: CELL, height: CELL, flexShrink: 0 }}
                    />
                  )
                }

                const clickable = isClickable(day)
                const isSelected = selected.has(day.date)
                const isNone = day.status === 'none'

                return (
                  <div
                    key={day.date}
                    onClick={() => clickable && onToggle(day.date)}
                    title={getTooltip(day)}
                    aria-label={getTooltip(day)}
                    className="rounded-sm transition-all duration-200 relative"
                    style={{
                      width: CELL,
                      height: CELL,
                      flexShrink: 0,
                      background: isNone ? '#C5CCCC' : statusColors[day.status],
                      opacity: !clickable ? 0.5 : 1,
                      cursor: clickable ? 'pointer' : 'default',
                      border: isSelected
                        ? '2px solid var(--apex-text)'
                        : undefined,
                      boxSizing: 'border-box',
                    }}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-xs" style={{ background: statusColors.green }} />
          <span className="text-[10px]" style={{ color: 'var(--apex-text-muted)' }}>Зелёный</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-xs" style={{ background: statusColors.red }} />
          <span className="text-[10px]" style={{ color: 'var(--apex-text-muted)' }}>Красный</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-xs" style={{ background: statusColors.absent }} />
          <span className="text-[10px]" style={{ color: 'var(--apex-text-muted)' }}>Отпуск</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-xs" style={{ background: '#C5CCCC' }} />
          <span className="text-[10px]" style={{ color: 'var(--apex-text-muted)' }}>Выходной</span>
        </div>
      </div>
    </div>
  )
}
