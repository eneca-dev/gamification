'use client'

import { useState, useEffect, useRef } from 'react'
import { Calendar, X, ChevronLeft, ChevronRight } from 'lucide-react'

interface DatePickerProps {
  value: string              // YYYY-MM-DD или ''
  onChange: (date: string) => void
  minDate?: string           // YYYY-MM-DD — даты раньше недоступны
  disabledDates?: Record<string, string>  // YYYY-MM-DD → подпись тултипа
  placeholder?: string
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

function formatFull(d: Date): string {
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

// ── Компонент ─────────────────────────────────────────────────────────────────

export function DatePicker({ value, onChange, minDate, disabledDates = {}, placeholder = 'Выберите дату' }: DatePickerProps) {
  const selected = parseDate(value)
  const minD = parseDate(minDate ?? '')
  const disabledMap = new Map(Object.entries(disabledDates))

  const [open, setOpen] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = selected ?? new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Синхронизируем месяц при внешнем изменении value
  useEffect(() => {
    if (selected) setCurrentMonth(new Date(selected.getFullYear(), selected.getMonth(), 1))
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const firstOffset = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (Date | null)[] = [
    ...Array(firstOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ]

  const monthTitle = currentMonth.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })

  function handleDay(d: Date) {
    if (minD && d < minD) return
    if (disabledMap.has(toISO(d))) return
    onChange(toISO(d))
    setOpen(false)
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange('')
  }

  return (
    <div className="relative w-full" ref={ref}>
      {/* Триггер — выглядит как input */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 text-[13px] transition-colors text-left"
        style={{
          background: 'var(--apex-bg)',
          border: `1px solid ${open ? 'var(--apex-primary)' : 'var(--apex-border)'}`,
          borderRadius: '10px',
          padding: '8px 12px',
          color: selected ? 'var(--apex-text)' : 'var(--apex-text-muted)',
          outline: 'none',
        }}
      >
        <Calendar size={14} style={{ color: 'var(--apex-text-muted)', flexShrink: 0 }} />
        <span className="flex-1">
          {selected ? formatFull(selected) : placeholder}
        </span>
        {selected && (
          <span
            onClick={handleClear}
            className="flex items-center justify-center w-4 h-4 rounded-full flex-shrink-0"
            style={{ background: 'var(--apex-border)' }}
          >
            <X size={9} style={{ color: 'var(--apex-text-secondary)' }} />
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
            width: '232px',
          }}
        >
          {/* Навигация по месяцу */}
          <div className="flex items-center justify-between mb-2.5">
            <button
              type="button"
              onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}
              className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--apex-bg)]"
              style={{ color: 'var(--apex-text-muted)' }}
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-[12px] font-semibold capitalize" style={{ color: 'var(--apex-text)' }}>
              {monthTitle}
            </span>
            <button
              type="button"
              onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}
              className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--apex-bg)]"
              style={{ color: 'var(--apex-text-muted)' }}
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Дни недели */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((wd, i) => (
              <div
                key={wd}
                className="h-6 flex items-center justify-center text-[10px] font-semibold"
                style={{ color: i >= 5 ? 'var(--apex-text-secondary)' : 'var(--apex-text-muted)' }}
              >
                {wd}
              </div>
            ))}
          </div>

          {/* Сетка дней */}
          <div className="grid grid-cols-7">
            {cells.map((d, i) => {
              if (!d) return <div key={i} className="w-8 h-8" />

              const iso = toISO(d)
              const isSelected = selected && sameDay(d, selected)
              const isToday = sameDay(d, today)
              const isPast = !!(minD && d < minD)
              const bookedLabel = disabledMap.get(iso)
              const isBooked = bookedLabel !== undefined
              const isDisabled = isPast || isBooked

              let bg = 'transparent'
              let color = 'var(--apex-text)'
              let borderColor = 'transparent'
              let extraClass = 'hover:bg-black/[0.04] cursor-pointer'

              if (isPast) {
                color = 'var(--apex-text-muted)'
                extraClass = 'cursor-not-allowed opacity-35'
              } else if (isBooked) {
                bg = 'var(--apex-error-bg)'
                color = 'var(--apex-danger-light)'
                extraClass = 'cursor-not-allowed'
              } else if (isSelected) {
                bg = 'var(--apex-primary)'
                color = '#ffffff'
                extraClass = ''
              } else if (isToday) {
                borderColor = 'var(--apex-primary)'
                color = 'var(--apex-primary)'
              }

              return (
                <div key={i} className="relative group flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => handleDay(d)}
                    disabled={isDisabled}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-medium transition-all ${extraClass}`}
                    style={{ background: bg, color, border: `1px solid ${borderColor}` }}
                  >
                    {d.getDate()}
                  </button>
                  {isBooked && bookedLabel && (
                    <div
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap pointer-events-none z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: 'var(--apex-surface)', color: 'var(--apex-text)', border: '1px solid var(--apex-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                    >
                      {bookedLabel}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
