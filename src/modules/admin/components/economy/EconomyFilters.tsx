'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useTransition } from 'react'

import { DateRangePicker } from '@/components/DateRangePicker'
import type { EconomyPeriodPreset, TopLevel } from '@/modules/admin'

interface EconomyFiltersProps {
  period: EconomyPeriodPreset
  customFrom: string
  customTo: string
  betaOnly: boolean
  topLevel: TopLevel
}

const PERIOD_OPTIONS: { value: EconomyPeriodPreset; label: string }[] = [
  { value: '7d', label: '7 дней' },
  { value: '30d', label: '30 дней' },
  { value: '90d', label: '90 дней' },
  { value: 'year', label: 'Год' },
  { value: 'all', label: 'Всё время' },
  { value: 'custom', label: 'Период' },
]

const LEVEL_OPTIONS: { value: TopLevel; label: string }[] = [
  { value: 'user', label: 'Сотрудники' },
  { value: 'team', label: 'Команды' },
  { value: 'department', label: 'Отделы' },
]

interface ChipButtonProps {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}

function ChipButton({ active, onClick, children }: ChipButtonProps) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1 rounded-full text-[12px] transition-all"
      style={{
        background: active ? 'var(--apex-success-bg)' : 'transparent',
        color: active ? 'var(--apex-primary)' : 'var(--apex-text-secondary)',
        border: `1px solid ${active ? 'var(--apex-primary)' : 'var(--apex-border)'}`,
        fontWeight: active ? 600 : 500,
      }}
    >
      {children}
    </button>
  )
}

export function EconomyFilters({ period, customFrom, customTo, betaOnly, topLevel }: EconomyFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const updateParam = (changes: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) params.delete(key)
      else params.set(key, value)
    }
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }

  const handlePeriod = (next: EconomyPeriodPreset) => {
    if (next === 'custom') {
      updateParam({ period: 'custom' })
    } else {
      updateParam({ period: next, from: null, to: null })
    }
  }

  const handleCustomRange = (from: string, to: string) => {
    updateParam({ period: 'custom', from: from || null, to: to || null })
  }

  const handleBeta = () => {
    updateParam({ beta: betaOnly ? 'off' : 'on' })
  }

  const handleLevel = (next: TopLevel) => {
    updateParam({ topLevel: next })
  }

  return (
    <div
      className={`rounded-2xl p-4 flex flex-wrap items-center gap-3 transition-opacity ${isPending ? 'opacity-70' : ''}`}
      style={{
        background: 'var(--apex-surface)',
        border: '1px solid var(--apex-border)',
      }}
    >
      {/* Период */}
      <div className="flex flex-wrap gap-1">
        {PERIOD_OPTIONS.map((opt) => (
          <ChipButton
            key={opt.value}
            active={period === opt.value}
            onClick={() => handlePeriod(opt.value)}
          >
            {opt.label}
          </ChipButton>
        ))}
      </div>

      {/* Кастомный диапазон — только при period=custom */}
      {period === 'custom' && (
        <DateRangePicker from={customFrom} to={customTo} onChange={handleCustomRange} />
      )}

      <div className="h-6 w-px" style={{ background: 'var(--apex-border)' }} />

      {/* Бета-тоггл */}
      <button
        onClick={handleBeta}
        role="switch"
        aria-checked={betaOnly}
        className="flex items-center gap-2 px-3 py-1 rounded-full text-[12px] transition-all"
        style={{
          background: betaOnly ? 'var(--apex-success-bg)' : 'transparent',
          color: betaOnly ? 'var(--apex-primary)' : 'var(--apex-text-secondary)',
          border: `1px solid ${betaOnly ? 'var(--apex-primary)' : 'var(--apex-border)'}`,
          fontWeight: betaOnly ? 600 : 500,
        }}
      >
        <span
          className="w-7 h-3.5 rounded-full relative inline-block"
          style={{ background: betaOnly ? 'var(--apex-primary)' : 'var(--apex-border)' }}
        >
          <span
            className="absolute top-0.5 left-0.5 w-2.5 h-2.5 rounded-full bg-white transition-transform duration-200"
            style={{ transform: betaOnly ? 'translateX(14px)' : 'translateX(0)' }}
          />
        </span>
        Только бета-тестеры
      </button>

      <div className="h-6 w-px" style={{ background: 'var(--apex-border)' }} />

      {/* Уровень для топов */}
      <div className="flex items-center gap-1">
        <span className="text-[12px] font-medium mr-1" style={{ color: 'var(--apex-text-muted)' }}>
          Топы:
        </span>
        {LEVEL_OPTIONS.map((opt) => (
          <ChipButton
            key={opt.value}
            active={topLevel === opt.value}
            onClick={() => handleLevel(opt.value)}
          >
            {opt.label}
          </ChipButton>
        ))}
      </div>
    </div>
  )
}
