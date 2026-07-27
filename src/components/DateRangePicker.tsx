'use client'

import { useState, useEffect, useRef } from 'react'
import { Calendar, X, ChevronLeft, ChevronRight } from 'lucide-react'

interface DateRangePickerProps {
  from: string   // YYYY-MM-DD или ''
  to: string     // YYYY-MM-DD или ''
  onChange: (from: string, to: string) => void
  months?: number // сколько месяцев показывать рядом (по умолчанию 1)
}

// ── Утилиты ───────────────────────────────────────────────────────────────────

function parseDate(s: string): Date | null {
  if (!s) return null
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

function formatShort(d: Date): string {
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

// ── Компонент ─────────────────────────────────────────────────────────────────

export function DateRangePicker({ from, to, onChange, months = 1 }: DateRangePickerProps) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<Date | null>(null)
  const [hover, setHover] = useState<Date | null>(null)
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = parseDate(from) ?? new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const ref = useRef<HTMLDivElement>(null)

  // Когда диапазон сброшен — возвращаемся к текущему месяцу
  useEffect(() => {
    if (!from && !to) {
      const now = new Date()
      setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1))
    }
  }, [from, to])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) {
        setOpen(false)
        setPending(null)
        setHover(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const fromDate = parseDate(from)
  const toDate = parseDate(to)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Текст триггера
  const triggerLabel = fromDate && toDate
    ? `${formatShort(fromDate)} — ${formatShort(toDate)}`
    : fromDate
      ? `с ${formatShort(fromDate)}`
      : toDate
        ? `по ${formatShort(toDate)}`
        : null

  const hasRange = !!(fromDate || toDate)

  // Одиночный клик
  const handleDay = (d: Date) => {
    if (!pending) {
      setPending(d)
      return
    }
    const min = d < pending ? d : pending
    const max = d < pending ? pending : d
    onChange(toISO(min), toISO(max))
    setPending(null)
    setHover(null)
    setOpen(false)
  }

  // Двойной клик — выбрать один день
  const handleDayDouble = (d: Date) => {
    const iso = toISO(d)
    onChange(iso, iso)
    setPending(null)
    setHover(null)
    setOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('', '')
    setPending(null)
  }

  // Отображаемый диапазон (с учётом hover-предпросмотра при новом выборе)
  let rangeFrom = fromDate
  let rangeTo = toDate
  if (pending) {
    const hoverTarget = hover ?? pending
    rangeFrom = pending < hoverTarget ? pending : hoverTarget
    rangeTo = pending < hoverTarget ? hoverTarget : pending
  }

  // Кнопка одного дня (подсветка выбора/диапазона/сегодня)
  const dayButton = (d: Date, key: number) => {
    const isToday = sameDay(d, today)
    const isFrom = rangeFrom && sameDay(d, rangeFrom)
    const isTo = rangeTo && rangeFrom && !sameDay(rangeFrom, rangeTo) && sameDay(d, rangeTo)
    const isSingleDay = rangeFrom && rangeTo && sameDay(rangeFrom, rangeTo) && sameDay(d, rangeFrom)
    const inRange = rangeFrom && rangeTo && d > rangeFrom && d < rangeTo

    let bg = 'transparent'
    let color = 'var(--apex-text)'
    let borderColor = 'transparent'
    let extraClass = 'hover:bg-black/[0.04]'
    if (isFrom || isTo || isSingleDay) { bg = 'var(--apex-primary)'; color = '#ffffff'; extraClass = '' }
    else if (inRange) { bg = 'rgba(27, 107, 88, 0.10)'; color = 'var(--apex-primary)'; extraClass = 'hover:bg-[rgba(27,107,88,0.18)]' }
    else if (isToday) { borderColor = 'var(--apex-primary)'; color = 'var(--apex-primary)' }

    return (
      <button
        key={key}
        onClick={() => handleDay(d)}
        onDoubleClick={() => handleDayDouble(d)}
        onMouseEnter={() => pending && setHover(d)}
        onMouseLeave={() => setHover(null)}
        className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-medium transition-all cursor-pointer ${extraClass}`}
        style={{ background: bg, color, border: `1px solid ${borderColor}` }}
      >
        {d.getDate()}
      </button>
    )
  }

  // Один месяц: заголовок (со стрелками по краям), дни недели, сетка дней
  const renderMonth = (offset: number) => {
    const base = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1)
    const y = base.getFullYear()
    const m = base.getMonth()
    const firstOffset = (new Date(y, m, 1).getDay() + 6) % 7
    const daysInMonth = new Date(y, m + 1, 0).getDate()
    const cells: (Date | null)[] = [
      ...Array(firstOffset).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => new Date(y, m, i + 1)),
    ]
    const title = base.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })

    return (
      <div key={offset} style={{ width: '224px' }}>
        <div className="flex items-center justify-between mb-2.5 h-6">
          {offset === 0 ? (
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
              className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--apex-bg)]"
              style={{ color: 'var(--apex-text-muted)' }}
            >
              <ChevronLeft size={14} />
            </button>
          ) : <span className="w-6" />}
          <span className="text-[12px] font-semibold capitalize" style={{ color: 'var(--apex-text)' }}>{title}</span>
          {offset === months - 1 ? (
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
              className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--apex-bg)]"
              style={{ color: 'var(--apex-text-muted)' }}
            >
              <ChevronRight size={14} />
            </button>
          ) : <span className="w-6" />}
        </div>
        <div className="grid grid-cols-7 mb-1">
          {WEEKDAYS.map((wd, i) => (
            <div key={wd} className="h-6 flex items-center justify-center text-[10px] font-semibold" style={{ color: i >= 5 ? 'var(--apex-text-secondary)' : 'var(--apex-text-muted)' }}>
              {wd}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d, i) => (d ? dayButton(d, i) : <div key={i} className="w-8 h-8" />))}
        </div>
      </div>
    )
  }

  const popupWidth = months * 224 + (months - 1) * 16 + 24

  return (
    <div className="relative" ref={ref}>
      {/* Кнопка-триггер */}
      <button
        onClick={() => { setOpen(v => !v); if (open) { setPending(null); setHover(null) } }}
        className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium transition-all"
        style={{
          background: hasRange ? 'var(--apex-success-bg)' : 'var(--apex-bg)',
          color: hasRange ? 'var(--apex-primary)' : 'var(--apex-text-muted)',
          border: hasRange
            ? `1px solid rgba(var(--apex-primary-rgb), 0.3)`
            : '1px solid var(--apex-border)',
        }}
      >
        <Calendar size={11} />
        <span>{triggerLabel ?? 'Период'}</span>
        {hasRange && (
          <span
            onClick={handleClear}
            className="flex items-center justify-center w-3.5 h-3.5 rounded-full"
            style={{ background: 'rgba(27,107,88,0.15)' }}
          >
            <X size={8} style={{ color: 'var(--apex-primary)' }} />
          </span>
        )}
      </button>

      {/* Попап-календарь */}
      {open && (
        <div
          className="absolute top-full left-0 mt-1.5 rounded-2xl z-50 p-3 select-none"
          style={{
            background: 'var(--apex-surface)',
            border: '1px solid var(--apex-border)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            width: `${popupWidth}px`,
          }}
        >
          <div className="flex gap-4">
            {Array.from({ length: months }, (_, k) => renderMonth(k))}
          </div>

          {/* Подсказка */}
          <div
            className="mt-2.5 pt-2 text-[10px] text-center"
            style={{ color: 'var(--apex-text-muted)', borderTop: '1px solid var(--apex-border)' }}
          >
            {pending
              ? 'Выберите конечную дату'
              : 'Двойной клик — выбрать один день'
            }
          </div>
        </div>
      )}
    </div>
  )
}
