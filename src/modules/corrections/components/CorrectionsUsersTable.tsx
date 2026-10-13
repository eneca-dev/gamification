'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Search, AlertTriangle, Flame, Zap } from 'lucide-react'

import { CoinStatic } from '@/components/CoinBalance'

import type { CorrectionUserRow } from '../types'

interface CorrectionsUsersTableProps {
  users: CorrectionUserRow[]
}

export function CorrectionsUsersTable({ users }: CorrectionsUsersTableProps) {
  const [search, setSearch] = useState('')
  const [mismatchOnly, setMismatchOnly] = useState(false)
  const [inactiveShown, setInactiveShown] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users
      .filter((u) => (inactiveShown ? true : u.is_active))
      .filter((u) => (mismatchOnly ? u.balance_mismatch : true))
      .filter((u) => {
        if (!q) return true
        return (
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.department ?? '').toLowerCase().includes(q) ||
          (u.team ?? '').toLowerCase().includes(q)
        )
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  }, [users, search, mismatchOnly, inactiveShown])

  const mismatchCount = useMemo(() => users.filter((u) => u.balance_mismatch).length, [users])

  return (
    <div className="space-y-3">
      <Toolbar
        search={search}
        onSearchChange={setSearch}
        mismatchOnly={mismatchOnly}
        onMismatchToggle={() => setMismatchOnly((v) => !v)}
        mismatchCount={mismatchCount}
        inactiveShown={inactiveShown}
        onInactiveToggle={() => setInactiveShown((v) => !v)}
        total={filtered.length}
      />

      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
      >
        <div
          className="grid grid-cols-[minmax(220px,2fr)_minmax(140px,1fr)_minmax(120px,1fr)_80px_80px_minmax(100px,1fr)_32px] gap-3 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--apex-text-muted)', borderBottom: '1px solid var(--apex-border)' }}
        >
          <div>Сотрудник</div>
          <div>Отдел / команда</div>
          <div>Место в WS / Revit</div>
          <div>WS стрик</div>
          <div>Revit стрик</div>
          <div>Баланс</div>
          <div />
        </div>

        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-[13px]" style={{ color: 'var(--apex-text-muted)' }}>
            Никого не нашли
          </div>
        ) : (
          filtered.map((u) => <UserRow key={u.id} user={u} />)
        )}
      </div>
    </div>
  )
}

// ===========================================================
// Toolbar
// ===========================================================

interface ToolbarProps {
  search: string
  onSearchChange: (v: string) => void
  mismatchOnly: boolean
  onMismatchToggle: () => void
  mismatchCount: number
  inactiveShown: boolean
  onInactiveToggle: () => void
  total: number
}

function Toolbar({
  search,
  onSearchChange,
  mismatchOnly,
  onMismatchToggle,
  mismatchCount,
  inactiveShown,
  onInactiveToggle,
  total,
}: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        className="flex items-center gap-2 rounded-xl px-3 h-10 min-w-[260px] flex-1"
        style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
      >
        <Search size={14} style={{ color: 'var(--apex-text-muted)' }} />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Поиск по имени, email, отделу..."
          className="flex-1 bg-transparent outline-none text-[13px]"
          style={{ color: 'var(--apex-text)' }}
        />
      </div>
      <ToolbarChip active={mismatchOnly} onClick={onMismatchToggle} icon={AlertTriangle}>
        Баланс ≠ транзакции · {mismatchCount}
      </ToolbarChip>
      <ToolbarChip active={inactiveShown} onClick={onInactiveToggle}>
        {inactiveShown ? 'Все пользователи' : 'Только активные'}
      </ToolbarChip>
      <div className="text-[12px] ml-auto" style={{ color: 'var(--apex-text-muted)' }}>
        Показано: {total}
      </div>
    </div>
  )
}

function ToolbarChip({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon?: typeof AlertTriangle
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl text-[12px] font-semibold transition-colors"
      style={{
        background: active ? 'var(--apex-primary)' : 'var(--apex-surface)',
        color: active ? 'var(--apex-on-primary)' : 'var(--apex-text-secondary)',
        border: '1px solid var(--apex-border)',
      }}
    >
      {Icon ? <Icon size={13} /> : null}
      {children}
    </button>
  )
}

// ===========================================================
// User row
// ===========================================================

function UserRow({ user }: { user: CorrectionUserRow }) {
  return (
    <Link
      href={`/admin/corrections/${user.id}`}
      className="grid grid-cols-[minmax(220px,2fr)_minmax(140px,1fr)_minmax(120px,1fr)_80px_80px_minmax(100px,1fr)_32px] gap-3 px-4 py-3 items-center transition-colors hover:bg-[rgba(var(--apex-primary-rgb),0.04)]"
      style={{ borderBottom: '1px solid var(--apex-border)' }}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold truncate" style={{ color: 'var(--apex-text)' }}>
            {user.name}
          </span>
          {!user.is_active ? <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--apex-bg)', color: 'var(--apex-text-muted)' }}>неактивен</span> : null}
          {user.balance_mismatch ? (
            <span
              className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-semibold"
              style={{ background: 'var(--apex-warning-bg)', color: 'var(--apex-warning-text)' }}
              title="Баланс не совпадает с суммой транзакций"
            >
              <AlertTriangle size={10} /> баланс
            </span>
          ) : null}
        </div>
        <div className="text-[11px] truncate" style={{ color: 'var(--apex-text-muted)' }}>
          {user.email}
        </div>
      </div>
      <div className="text-[12px] min-w-0">
        <div className="truncate" style={{ color: 'var(--apex-text)' }}>{user.department ?? '—'}</div>
        <div className="truncate text-[11px]" style={{ color: 'var(--apex-text-muted)' }}>{user.team ?? '—'}</div>
      </div>
      <div className="text-[12px]" style={{ color: 'var(--apex-text-secondary)' }}>
        <div>WS: {user.rank_ws ? `#${user.rank_ws}` : '—'}</div>
        <div>Revit: {user.rank_revit ? `#${user.rank_revit}` : '—'}</div>
      </div>
      <StreakCell value={user.ws_streak} icon={Flame} />
      <StreakCell value={user.revit_streak} icon={Zap} />
      <div className="text-[13px] font-semibold">
        <CoinStatic amount={user.total_coins} size="sm" />
      </div>
      <ChevronRight size={16} style={{ color: 'var(--apex-text-muted)' }} />
    </Link>
  )
}

function StreakCell({ value, icon: Icon }: { value: number | null; icon: typeof Flame }) {
  if (value === null || value === 0) {
    return (
      <div className="inline-flex items-center gap-1 text-[12px]" style={{ color: 'var(--apex-text-muted)' }}>
        <Icon size={12} />0
      </div>
    )
  }
  return (
    <div className="inline-flex items-center gap-1 text-[12px] font-semibold" style={{ color: 'var(--apex-text)' }}>
      <Icon size={12} style={{ color: 'var(--apex-primary)' }} />
      {value}
    </div>
  )
}
