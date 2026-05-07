'use client'

import { useRouter } from 'next/navigation'
import { ArrowUp, ArrowDown } from 'lucide-react'
import { useState } from 'react'
import { DateRangePicker } from './DateRangePicker'

// ── Helpers ──────────────────────────────────────────────────────────────────

const DEFAULTS: Record<string, string> = { source: 'all', page: '1' }

function buildUrl(params: Record<string, string>): string {
  const p = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v && v !== DEFAULTS[k]) p.set(k, v)
  })
  return `/transactions?${p.toString()}`
}

// ── SortToggle ────────────────────────────────────────────────────────────────

interface SortToggleProps {
  currentSort: string
  currentSource: string
  currentDateFrom: string
  currentDateTo: string
}

export function SortToggle({ currentSort, currentSource, currentDateFrom, currentDateTo }: SortToggleProps) {
  const router = useRouter()

  const navigate = (newSort: string) => {
    router.push(buildUrl({
      sort: newSort,
      source: currentSource,
      date_from: currentDateFrom,
      date_to: currentDateTo,
      page: '1',
    }))
  }

  return (
    <div className="flex items-center gap-0.5">
      <SortButton
        active={currentSort === 'date_asc'}
        tooltip="Показать сначала старые"
        onClick={() => navigate('date_asc')}
      >
        <ArrowUp size={13} />
      </SortButton>
      <SortButton
        active={currentSort === 'date_desc'}
        tooltip="Показать сначала новые"
        onClick={() => navigate('date_desc')}
      >
        <ArrowDown size={13} />
      </SortButton>
    </div>
  )
}

interface SortButtonProps {
  active: boolean
  tooltip: string
  onClick: () => void
  children: React.ReactNode
}

function SortButton({ active, tooltip, onClick, children }: SortButtonProps) {
  const [show, setShow] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={onClick}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
        style={{
          background: active ? 'var(--apex-primary)' : 'var(--apex-bg)',
          color: active ? '#ffffff' : 'var(--apex-text-muted)',
          border: active ? '1px solid var(--apex-primary)' : '1px solid var(--apex-border)',
        }}
      >
        {children}
      </button>
      {show && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap pointer-events-none"
          style={{
            zIndex: 50,
            background: 'var(--apex-surface)',
            color: 'var(--apex-text)',
            border: '1px solid var(--apex-border)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          }}
        >
          {tooltip}
          <div
            className="absolute top-full left-1/2 -translate-x-1/2 w-1.5 h-1.5 rotate-45"
            style={{ background: 'var(--apex-surface)', borderRight: '1px solid var(--apex-border)', borderBottom: '1px solid var(--apex-border)' }}
          />
        </div>
      )}
    </div>
  )
}

// ── TransactionsFilters ───────────────────────────────────────────────────────

const SOURCE_OPTIONS = [
  { value: 'all', label: 'Все' },
  { value: 'ws', label: 'Worksection' },
  { value: 'revit', label: 'Revit' },
  { value: 'airtable', label: 'Благодарности' },
  { value: 'achievements', label: 'Достижения' },
  { value: 'shop', label: 'Магазин' },
]

interface TransactionsFiltersProps {
  currentSort: string
  currentSource: string
  currentDateFrom: string
  currentDateTo: string
}

export function TransactionsFilters({ currentSort, currentSource, currentDateFrom, currentDateTo }: TransactionsFiltersProps) {
  const router = useRouter()

  const navigate = (overrides: Partial<Record<string, string>>) => {
    router.push(buildUrl({
      sort: currentSort,
      source: currentSource,
      date_from: currentDateFrom,
      date_to: currentDateTo,
      page: '1',
      ...overrides,
    }))
  }

  return (
    <div className="space-y-2.5 pb-4 mb-2">
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
