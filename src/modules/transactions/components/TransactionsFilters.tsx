'use client'

import { DateRangePicker } from '@/components/DateRangePicker'

// ── Helpers ──────────────────────────────────────────────────────────────────

const DEFAULTS: Record<string, string> = { source: 'all', page: '1' }

export function buildTransactionsUrl(params: Record<string, string>): string {
  const p = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v && v !== DEFAULTS[k]) p.set(k, v)
  })
  return `/transactions?${p.toString()}`
}

// ── TransactionsFilters ───────────────────────────────────────────────────────

const SOURCE_OPTIONS = [
  { value: 'all', label: 'Все' },
  { value: 'ws', label: 'Worksection' },
  { value: 'revit', label: 'Revit' },
  { value: 'gratitudes', label: 'Благодарности' },
  { value: 'achievements', label: 'Достижения' },
  { value: 'shop', label: 'Магазин' },
]

interface TransactionsFiltersProps {
  currentSort: string
  currentSource: string
  currentDateFrom: string
  currentDateTo: string
  onNavigate: (url: string) => void
}

export function TransactionsFilters({ currentSort, currentSource, currentDateFrom, currentDateTo, onNavigate }: TransactionsFiltersProps) {
  const navigate = (overrides: Partial<Record<string, string>>) => {
    onNavigate(buildTransactionsUrl({
      sort: currentSort,
      source: currentSource,
      date_from: currentDateFrom,
      date_to: currentDateTo,
      page: '1',
      ...overrides,
    }))
  }

  return (
    <div className="space-y-2.5 pb-4 mb-2" data-onboarding="transactions-filters">
      <FilterRow label="Тип">
        {SOURCE_OPTIONS.map((opt) => (
          <FilterPill
            key={opt.value}
            active={currentSource === opt.value}
            onClick={() => navigate({ source: opt.value })}
          >
            {opt.label}
          </FilterPill>
        ))}
      </FilterRow>

      <FilterRow label="Дата">
        <DateRangePicker
          from={currentDateFrom ?? ''}
          to={currentDateTo ?? ''}
          onChange={(from, to) => navigate({ date_from: from, date_to: to })}
        />
      </FilterRow>
    </div>
  )
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-[11px] font-medium w-14 flex-shrink-0 pt-[3px]" style={{ color: 'var(--apex-text-muted)' }}>
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {children}
      </div>
    </div>
  )
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1 rounded-full text-[11px] font-medium transition-colors"
      style={{
        background: active ? 'var(--apex-primary)' : 'var(--apex-bg)',
        color: active ? '#ffffff' : 'var(--apex-text-muted)',
        border: active ? '1px solid var(--apex-primary)' : '1px solid var(--apex-border)',
      }}
    >
      {children}
    </button>
  )
}
