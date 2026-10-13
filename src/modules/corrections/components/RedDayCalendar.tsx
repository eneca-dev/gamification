'use client'

import { useMemo, useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Shield } from 'lucide-react'

import type { CorrectionCalendarDay } from '../types'

interface RedDayCalendarProps {
  days: CorrectionCalendarDay[]
  selected: Set<string>
  onToggle: (date: string) => void
}

// Константы — те же, что в StreakPanel на главной.
const CELL = 18
const CELL_GAP = 3
const MONTH_SEP = 16
const VISIBLE_MONTHS = 4

const DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

type RenderStatus = 'green' | 'red' | 'frozen' | 'gray' | 'no_data' | 'future' | 'out'

const statusColors: Record<RenderStatus, string> = {
  green:   'var(--apex-primary)',
  red:     'var(--apex-danger)',
  gray:    '#C5CCCC',
  frozen:  'var(--apex-info-text)',
  future:  'transparent',
  out:     'transparent',
  no_data: '#C5CCCC',
}

const statusLabels: Record<RenderStatus, string> = {
  green:   'Зелёный',
  red:     'Красный',
  gray:    'Выходной',
  frozen:  'Отсутствие',
  future:  'Ещё не наступил',
  out:     '',
  no_data: 'Нет данных',
}

export function RedDayCalendar({ days, selected, onToggle }: RedDayCalendarProps) {
  const months = useMemo(() => buildMonths(days), [days])
  const todayIso = useMemo(() => (days.length > 0 ? days[days.length - 1].date : ''), [days])

  // startIdx — индекс самого левого видимого месяца.
  // Инициализация: показать последние VISIBLE_MONTHS, включая текущий.
  const defaultStart = Math.max(0, months.length - VISIBLE_MONTHS)
  const [startIdx, setStartIdx] = useState(defaultStart)

  useEffect(() => {
    const maxStart = Math.max(0, months.length - VISIBLE_MONTHS)
    if (startIdx > maxStart) setStartIdx(maxStart)
  }, [months.length, startIdx])

  if (months.length === 0) {
    return (
      <section
        className="rounded-2xl p-5"
        style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
      >
        <div className="text-[13px]" style={{ color: 'var(--apex-text-muted)' }}>
          Нет данных по дням
        </div>
      </section>
    )
  }

  const maxStart = Math.max(0, months.length - VISIBLE_MONTHS)
  const safeStart = Math.max(0, Math.min(startIdx, maxStart))
  const visible = months.slice(safeStart, safeStart + VISIBLE_MONTHS)
  const canPrev = safeStart > 0
  const canNext = safeStart < maxStart

  return (
    <section
      className="rounded-2xl p-5"
      style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
    >
      {/* Шапка: стрелка влево — месяцы — стрелка вправо */}
      <div className="flex items-center justify-between mb-4 gap-3">
        <button
          type="button"
          onClick={() => canPrev && setStartIdx(safeStart - 1)}
          disabled={!canPrev}
          className="w-7 h-7 inline-flex items-center justify-center rounded-lg transition-colors disabled:opacity-30 shrink-0"
          style={{ background: 'var(--apex-bg)', border: '1px solid var(--apex-border)', color: 'var(--apex-text-secondary)' }}
          aria-label="На месяц назад"
        >
          <ChevronLeft size={14} />
        </button>

        <div className="flex items-start overflow-x-auto" style={{ gap: MONTH_SEP }}>
          {visible.map((m) => (
            <div key={m.key} className="flex flex-col">
              <div
                className="text-[9px] font-semibold uppercase tracking-wider mb-1.5"
                style={{ color: 'var(--apex-text-muted)' }}
              >
                {m.name} {m.year}
              </div>
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
                {m.weeks.map((week, wIdx) => (
                  <div key={wIdx} className="flex" style={{ gap: CELL_GAP }}>
                    {week.map((day, dIdx) =>
                      day ? (
                        <DayCell
                          key={day.date}
                          day={day}
                          isToday={day.date === todayIso}
                          selected={selected.has(day.date)}
                          onToggle={onToggle}
                        />
                      ) : (
                        <div
                          key={`empty-${wIdx}-${dIdx}`}
                          style={{ width: CELL, height: CELL, flexShrink: 0 }}
                        />
                      ),
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => canNext && setStartIdx(safeStart + 1)}
          disabled={!canNext}
          className="w-7 h-7 inline-flex items-center justify-center rounded-lg transition-colors disabled:opacity-30 shrink-0"
          style={{ background: 'var(--apex-bg)', border: '1px solid var(--apex-border)', color: 'var(--apex-text-secondary)' }}
          aria-label="На месяц вперёд"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Легенда — как на главной */}
      <div className="flex items-center gap-3 mt-2 flex-wrap">
        {(['green', 'red', 'frozen'] as RenderStatus[]).map((s) => (
          <div key={s} className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-xs" style={{ background: statusColors[s] }} />
            <span className="text-[10px]" style={{ color: 'var(--apex-text-muted)' }}>
              {statusLabels[s]}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-1">
          <div
            className="w-2.5 h-2.5 rounded-xs"
            style={{ background: '#C5CCCC', border: '1.5px dashed var(--apex-text-muted)', boxSizing: 'border-box', opacity: 0.5 }}
          />
          <span className="text-[10px]" style={{ color: 'var(--apex-text-muted)' }}>
            Нет данных
          </span>
        </div>
        <div className="flex items-center gap-1">
          <div
            className="w-2.5 h-2.5 rounded-xs flex items-center justify-center"
            style={{ background: 'var(--apex-primary)' }}
          >
            <span style={{ color: 'white', fontSize: 7, lineHeight: 1, fontWeight: 'bold' }}>★</span>
          </div>
          <span className="text-[10px]" style={{ color: 'var(--apex-text-muted)' }}>
            Revit
          </span>
        </div>
        <div className="flex items-center gap-1">
          <div
            className="w-2.5 h-2.5 rounded-xs flex items-center justify-center"
            style={{ background: 'var(--apex-danger)' }}
          >
            <Shield size={7} style={{ color: 'white' }} fill="white" strokeWidth={1} />
          </div>
          <span className="text-[10px]" style={{ color: 'var(--apex-text-muted)' }}>
            Щит
          </span>
        </div>
        <span className="ml-auto text-[11px]" style={{ color: 'var(--apex-text-muted)' }}>
          {selected.size > 0 ? (
            <>Выбрано: <span style={{ color: 'var(--apex-text)' }}>{selected.size}</span></>
          ) : (
            'Клик по дню — добавить в выборку'
          )}
        </span>
      </div>
    </section>
  )
}

// ===========================================================
// Ячейка дня
// ===========================================================

function DayCell({
  day,
  isToday,
  selected,
  onToggle,
}: {
  day: CorrectionCalendarDay
  isToday: boolean
  selected: boolean
  onToggle: (date: string) => void
}) {
  const render = toRenderStatus(day)
  const isNoData = render === 'no_data'
  const isFuture = render === 'future'
  const showStar = day.revit_launches > 0 && render !== 'frozen'
  const showShield = day.has_shield

  if (showShield && !isFuture) {
    const fillColor = isNoData ? '#C5CCCC' : (statusColors[render] as string)
    return (
      <button
        type="button"
        onClick={() => onToggle(day.date)}
        title={getDayTooltip(day, render, isToday)}
        className="relative transition-all"
        style={{
          width: CELL,
          height: CELL,
          flexShrink: 0,
          padding: 0,
          background: 'transparent',
          border: 'none',
          outline: selected ? '2px solid var(--apex-primary)' : 'none',
          outlineOffset: 1,
          cursor: 'pointer',
        }}
      >
        <svg width={CELL} height={CELL} viewBox="0 0 18 18">
          <path
            d="M 1 1 L 17 1 L 17 10 Q 17 16 9 18 Q 1 16 1 10 Z"
            fill={fillColor}
            fillOpacity={isNoData ? 0.5 : 1}
            stroke={isToday ? 'var(--apex-primary)' : 'none'}
            strokeWidth={isToday ? 1.5 : 0}
          />
          {showStar && (
            <text x="9" y="12" textAnchor="middle" fontSize="10" fill="white" fontWeight="bold" opacity="0.9">
              ★
            </text>
          )}
        </svg>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onToggle(day.date)}
      title={getDayTooltip(day, render, isToday)}
      className="rounded-sm relative transition-all"
      style={{
        width: CELL,
        height: CELL,
        flexShrink: 0,
        padding: 0,
        background: isFuture ? 'transparent' : statusColors[render],
        opacity: isNoData ? 0.5 : 1,
        border: isToday
          ? '2px solid var(--apex-primary)'
          : isFuture
          ? '1.5px dashed rgba(var(--apex-primary-rgb), 0.25)'
          : isNoData
          ? '1.5px dashed var(--apex-text-muted)'
          : 'none',
        outline: selected ? '2px solid var(--apex-primary)' : 'none',
        outlineOffset: 1,
        boxSizing: 'border-box',
        cursor: 'pointer',
      }}
    >
      {showStar && (
        <span
          className="absolute inset-0 flex items-center justify-center font-bold leading-none"
          style={{
            color: 'white',
            fontSize: 10,
            opacity: 0.9,
            WebkitTextStroke: isNoData ? '0.5px black' : undefined,
          }}
        >
          ★
        </span>
      )}
    </button>
  )
}

// ===========================================================
// Хелперы
// ===========================================================

function toRenderStatus(day: CorrectionCalendarDay): RenderStatus {
  if (day.status === 'green') return 'green'
  if (day.status === 'red') return 'red'
  if (day.status === 'absent') return 'frozen'
  if (day.status === 'revit') return 'gray'
  const dow = (new Date(day.date + 'T00:00:00').getDay() + 6) % 7
  if (dow >= 5) return 'gray'
  return 'no_data'
}

function getDayTooltip(day: CorrectionCalendarDay, render: RenderStatus, isToday: boolean): string {
  const parts: string[] = []
  parts.push(formatDate(day.date))
  if (isToday) parts.push('сегодня')
  parts.push(statusLabels[render] || '—')
  if (day.absence_type) parts.push(day.absence_type)
  if (day.coins > 0) parts.push(`+${day.coins}💎`)
  if (day.revit_launches > 0) parts.push(`Revit ×${day.revit_launches}`)
  if (day.has_shield) parts.push('щит')
  return parts.join(' · ')
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

// ===========================================================
// Группировка дней в месяцы (неделя начинается с ПН)
// ===========================================================

interface MonthView {
  key: string
  year: number
  name: string
  weeks: (CorrectionCalendarDay | null)[][]
}

function buildMonths(days: CorrectionCalendarDay[]): MonthView[] {
  if (days.length === 0) return []

  const byMonth = new Map<string, CorrectionCalendarDay[]>()
  for (const day of days) {
    const m = day.date.slice(0, 7)
    const list = byMonth.get(m) ?? []
    list.push(day)
    byMonth.set(m, list)
  }

  return [...byMonth.keys()].sort().map((key) => {
    const [year, monthStr] = key.split('-')
    const monthIdx = Number(monthStr) - 1
    const monthDays = byMonth.get(key)!.sort((a, b) => a.date.localeCompare(b.date))

    const firstDate = new Date(monthDays[0].date + 'T00:00:00')
    const firstDow = (firstDate.getDay() + 6) % 7

    const lastInMonth = new Date(Number(year), monthIdx + 1, 0).getDate()
    const lastShownDay = Number(monthDays[monthDays.length - 1].date.slice(8, 10))

    const padded: (CorrectionCalendarDay | null)[] = []
    for (let i = 0; i < firstDow; i += 1) padded.push(null)

    const byDayNum = new Map<number, CorrectionCalendarDay>()
    for (const d of monthDays) byDayNum.set(Number(d.date.slice(8, 10)), d)

    const upTo = Math.max(lastInMonth, lastShownDay)
    for (let n = 1; n <= upTo; n += 1) {
      padded.push(byDayNum.get(n) ?? null)
    }
    while (padded.length % 7 !== 0) padded.push(null)

    const weeks: (CorrectionCalendarDay | null)[][] = []
    for (let i = 0; i < padded.length; i += 7) {
      weeks.push(padded.slice(i, i + 7))
    }

    return { key, year: Number(year), name: MONTH_NAMES[monthIdx], weeks }
  })
}
