'use client'

import { useState, useTransition } from 'react'
import { createPortal } from 'react-dom'

import {
  addCalendarHoliday, deleteCalendarHoliday,
  addCalendarWorkday, deleteCalendarWorkday,
} from '@/modules/admin/index.client'

import type { CalendarHolidayRow, CalendarWorkdayRow } from '../types'

interface CalendarClientProps {
  initialHolidays: CalendarHolidayRow[]
  initialWorkdays: CalendarWorkdayRow[]
}

// --- Утилиты ---

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`
}

function isNaturalWeekend(year: number, month: number, day: number): boolean {
  const dow = new Date(year, month, day).getDay()
  return dow === 0 || dow === 6
}

function getMonthName(month: number): string {
  return new Date(2024, month).toLocaleDateString('ru-RU', { month: 'long' })
}

/** Дни месяца: массив недель, каждая неделя — 7 слотов (null = пустой) */
function getMonthGrid(year: number, month: number): (number | null)[][] {
  const firstDay = new Date(year, month, 1).getDay()
  // Пн=0..Вс=6 (ISO)
  const offset = firstDay === 0 ? 6 : firstDay - 1
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const weeks: (number | null)[][] = []
  let week: (number | null)[] = new Array(offset).fill(null)

  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d)
    if (week.length === 7) {
      weeks.push(week)
      week = []
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null)
    weeks.push(week)
  }

  return weeks
}

type DayState = 'workday' | 'weekend' | 'holiday' | 'workday_transfer'

function generateMonths(now: Date): { year: number; month: number }[] {
  const result: { year: number; month: number }[] = []
  const currentYear = now.getFullYear()

  // Январь текущего года → декабрь + 1 месяц следующего года
  for (let m = 0; m < 13; m++) {
    const year = currentYear + Math.floor(m / 12)
    const month = m % 12
    result.push({ year, month })
  }
  return result
}

// --- Компонент ---

export function CalendarClient({ initialHolidays, initialWorkdays }: CalendarClientProps) {
  const [holidays, setHolidays] = useState(initialHolidays)
  const [workdays, setWorkdays] = useState(initialWorkdays)
  const [, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [notification, setNotification] = useState<string | null>(null)

  const holidayMap = new Map(holidays.map(h => [h.date, h]))
  const workdayMap = new Map(workdays.map(w => [w.date, w]))

  const months = generateMonths(new Date())

  function showNotification(msg: string) {
    setNotification(msg)
    setTimeout(() => setNotification(null), 3000)
  }

  function getDayState(year: number, month: number, day: number): DayState {
    const dateStr = toDateStr(year, month, day)
    if (holidayMap.has(dateStr)) return 'holiday'
    if (workdayMap.has(dateStr)) return 'workday_transfer'
    if (isNaturalWeekend(year, month, day)) return 'weekend'
    return 'workday'
  }

  function handleDayClick(year: number, month: number, day: number) {
    const dateStr = toDateStr(year, month, day)
    const state = getDayState(year, month, day)

    setError(null)

    if (state === 'holiday') {
      // Убираем праздник → возвращаем в обычный будний
      const entry = holidayMap.get(dateStr)!
      const prev = holidays
      setHolidays(h => h.filter(item => item.id !== entry.id))

      startTransition(async () => {
        const result = await deleteCalendarHoliday({ id: entry.id })
        if (!result.success) {
          setHolidays(prev)
          setError(result.error)
          return
        }
        showNotification('День возвращён в рабочие')
      })
      return
    }

    if (state === 'workday_transfer') {
      // Убираем рабочий перенос → возвращаем в обычный выходной
      const entry = workdayMap.get(dateStr)!
      const prev = workdays
      setWorkdays(w => w.filter(item => item.id !== entry.id))

      startTransition(async () => {
        const result = await deleteCalendarWorkday({ id: entry.id })
        if (!result.success) {
          setWorkdays(prev)
          setError(result.error)
          return
        }
        showNotification('День возвращён в выходные')
      })
      return
    }

    if (state === 'workday') {
      // Будний → делаем выходным
      const optimistic: CalendarHolidayRow = {
        id: -Date.now(),
        date: dateStr,
        name: 'Выходной',
        created_at: new Date().toISOString(),
      }
      const prev = holidays
      setHolidays(h => [...h, optimistic])

      startTransition(async () => {
        const result = await addCalendarHoliday({ date: dateStr, name: 'Выходной' })
        if (!result.success) {
          setHolidays(prev)
          setError(result.error)
          return
        }
        setHolidays(h => h.map(item => item.id === optimistic.id ? result.data : item))
        showNotification('День отмечен как выходной')
      })
      return
    }

    if (state === 'weekend') {
      // Выходной → делаем рабочим
      const optimistic: CalendarWorkdayRow = {
        id: -Date.now(),
        date: dateStr,
        name: 'Рабочий перенос',
        created_at: new Date().toISOString(),
      }
      const prev = workdays
      setWorkdays(w => [...w, optimistic])

      startTransition(async () => {
        const result = await addCalendarWorkday({ date: dateStr, name: 'Рабочий перенос' })
        if (!result.success) {
          setWorkdays(prev)
          setError(result.error)
          return
        }
        setWorkdays(w => w.map(item => item.id === optimistic.id ? result.data : item))
        showNotification('День отмечен как рабочий')
      })
    }
  }

  return (
    <div className="space-y-5">
      {/* Toast */}
      {notification && createPortal(
        <div className="fixed top-6 right-6 z-50 animate-fade-in-up">
          <div
            className="rounded-xl px-5 py-3 text-[13px] font-semibold shadow-lg"
            style={{
              background: 'var(--apex-success-bg)',
              color: 'var(--apex-success-text)',
              border: '1px solid rgba(var(--apex-primary-rgb), 0.15)',
            }}
          >
            {notification}
          </div>
        </div>,
        document.body,
      )}

      {/* Error */}
      {error && (
        <div
          className="rounded-xl px-5 py-3 text-[13px] font-medium"
          style={{ background: 'var(--apex-error-bg)', color: 'var(--apex-danger)' }}
        >
          {error}
        </div>
      )}

      {/* Легенда */}
      <div
        className="flex items-center gap-4 flex-wrap rounded-xl px-5 py-3"
        style={{
          background: 'var(--apex-surface)',
          border: '1px solid var(--apex-border)',
        }}
      >
        <span className="text-[13px] font-medium" style={{ color: 'var(--apex-text-secondary)' }}>
          Кликните на день чтобы переключить:
        </span>
        <LegendItem color="var(--apex-bg)" borderColor="var(--apex-border)" label="Будний" />
        <LegendItem color="var(--apex-border)" borderColor="transparent" label="Выходной" />
        <LegendItem color="var(--apex-danger)" borderColor="transparent" label="Выходной (ручной)" textWhite />
        <LegendItem color="var(--apex-primary)" borderColor="transparent" label="Рабочий (перенос)" textWhite />
      </div>

      {/* Сетка месяцев */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {months.map(({ year, month }) => (
          <MonthCard
            key={`${year}-${month}`}
            year={year}
            month={month}
            getDayState={(d) => getDayState(year, month, d)}
            onDayClick={(d) => handleDayClick(year, month, d)}
          />
        ))}
      </div>
    </div>
  )
}

// --- Легенда ---

interface LegendItemProps {
  color: string
  borderColor: string
  label: string
  textWhite?: boolean
}

function LegendItem({ color, borderColor, label, textWhite }: LegendItemProps) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="w-5 h-5 rounded-md"
        style={{
          background: color,
          border: `1px solid ${borderColor}`,
        }}
      />
      <span
        className="text-[12px]"
        style={{ color: textWhite ? 'var(--apex-text-secondary)' : 'var(--apex-text-secondary)' }}
      >
        {label}
      </span>
    </div>
  )
}

// --- Карточка месяца ---

interface MonthCardProps {
  year: number
  month: number
  getDayState: (day: number) => DayState
  onDayClick: (day: number) => void
}

function MonthCard({ year, month, getDayState, onDayClick }: MonthCardProps) {
  const weeks = getMonthGrid(year, month)
  const now = new Date()
  const todayStr = toDateStr(now.getFullYear(), now.getMonth(), now.getDate())

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: 'var(--apex-surface)',
        border: '1px solid var(--apex-border)',
      }}
    >
      {/* Заголовок месяца */}
      <div
        className="px-3 py-2 text-center"
        style={{ borderBottom: '1px solid var(--apex-border)' }}
      >
        <span
          className="text-[13px] font-semibold capitalize"
          style={{ color: 'var(--apex-text-primary)' }}
        >
          {getMonthName(month)} {year}
        </span>
      </div>

      {/* Дни недели */}
      <div className="grid grid-cols-7 px-2 pt-2">
        {WEEKDAYS.map((wd, i) => (
          <div
            key={wd}
            className="text-center text-[11px] font-medium pb-1"
            style={{ color: i >= 5 ? 'var(--apex-text-tertiary)' : 'var(--apex-text-secondary)' }}
          >
            {wd}
          </div>
        ))}
      </div>

      {/* Сетка дней */}
      <div className="px-2 pb-2">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-0.5">
            {week.map((day, di) => {
              if (day === null) {
                return <div key={di} className="aspect-square" />
              }

              const state = getDayState(day)
              const dateStr = toDateStr(year, month, day)
              const isToday = dateStr === todayStr
              const { bg, textColor, border } = getDayStyles(state)

              return (
                <button
                  key={di}
                  onClick={() => onDayClick(day)}
                  className="aspect-square rounded-md flex items-center justify-center text-[12px] font-medium transition-all duration-100 hover:ring-2 hover:ring-offset-1"
                  style={{
                    background: bg,
                    color: textColor,
                    border,
                    boxShadow: isToday ? 'inset 0 0 0 2px var(--apex-primary)' : undefined,
                    ['--tw-ring-color' as string]: 'var(--apex-primary)',
                  }}
                  title={getDayTitle(state, dateStr)}
                >
                  {day}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// --- Стили и тексты ---

function getDayStyles(state: DayState): { bg: string; textColor: string; border: string } {
  switch (state) {
    case 'workday':
      return {
        bg: 'var(--apex-bg)',
        textColor: 'var(--apex-text-primary)',
        border: '1px solid var(--apex-border)',
      }
    case 'weekend':
      return {
        bg: 'var(--apex-border)',
        textColor: 'var(--apex-text-tertiary)',
        border: '1px solid transparent',
      }
    case 'holiday':
      return {
        bg: 'var(--apex-danger)',
        textColor: 'white',
        border: '1px solid transparent',
      }
    case 'workday_transfer':
      return {
        bg: 'var(--apex-primary)',
        textColor: 'white',
        border: '1px solid transparent',
      }
  }
}

function getDayTitle(state: DayState, dateStr: string): string {
  const formatted = new Date(dateStr + 'T00:00:00').toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  switch (state) {
    case 'workday': return `${formatted} — рабочий день (клик → сделать выходным)`
    case 'weekend': return `${formatted} — выходной (клик → сделать рабочим)`
    case 'holiday': return `${formatted} — выходной (ручной, клик → вернуть рабочим)`
    case 'workday_transfer': return `${formatted} — рабочий перенос (клик → вернуть выходным)`
  }
}
