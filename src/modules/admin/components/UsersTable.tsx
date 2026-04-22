'use client'

import { useState, useTransition, useMemo, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Search, ChevronRight, ChevronDown, ChevronsUp, ChevronsDown, ChevronUp, Check, Users } from 'lucide-react'

import { CoinStatic } from '@/components/CoinBalance'
import { toggleAdmin, toggleBetaTester } from '@/modules/admin/index.client'

import type { AdminUserRow } from '../types'

// --- Группировка Отдел → Команда → Пользователи ---

interface DeptGroup {
  label: string
  teams: TeamGroup[]
}

interface TeamGroup {
  label: string
  users: AdminUserRow[]
}

function buildGroups(users: AdminUserRow[]): DeptGroup[] {
  const deptMap = new Map<string, Map<string, AdminUserRow[]>>()

  for (const user of users) {
    const dept = user.department ?? 'Без отдела'
    if (!deptMap.has(dept)) deptMap.set(dept, new Map())
    const teamMap = deptMap.get(dept)!
    const team = user.team?.trim() || 'Без команды'
    if (!teamMap.has(team)) teamMap.set(team, [])
    teamMap.get(team)!.push(user)
  }

  return Array.from(deptMap.entries())
    .sort(([a], [b]) => a.localeCompare(b, 'ru'))
    .map(([dept, teamMap]) => ({
      label: dept,
      teams: Array.from(teamMap.entries())
        .sort(([a], [b]) => a.localeCompare(b, 'ru'))
        .map(([team, teamUsers]) => ({
          label: team,
          users: teamUsers.sort((a, b) => a.last_name.localeCompare(b.last_name, 'ru')),
        })),
    }))
}

function countDeptUsers(dept: DeptGroup): number {
  return dept.teams.reduce((acc, t) => acc + t.users.length, 0)
}

// --- Основной компонент ---

interface UsersTableProps {
  users: AdminUserRow[]
}

export function UsersTable({ users }: UsersTableProps) {
  const [items, setItems] = useState(users)
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('all')
  const [adminsOnly, setAdminsOnly] = useState(false)
  const [betaOnly, setBetaOnly] = useState(false)
  const [allExpanded, setAllExpanded] = useState(true)
  const [expandKey, setExpandKey] = useState(0)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const departments = useMemo(() => {
    const depts = new Set(items.map((u) => u.department).filter(Boolean) as string[])
    return Array.from(depts).sort((a, b) => a.localeCompare(b, 'ru'))
  }, [items])

  const filtered = useMemo(() => {
    return items.filter((u) => {
      if (adminsOnly && !u.is_admin) return false
      if (betaOnly && !u.is_beta_tester) return false
      if (deptFilter !== 'all' && u.department !== deptFilter) return false
      if (search) {
        const q = search.toLowerCase()
        if (
          !`${u.first_name} ${u.last_name}`.toLowerCase().includes(q) &&
          !u.email.toLowerCase().includes(q)
        ) return false
      }
      return true
    })
  }, [items, search, deptFilter, adminsOnly, betaOnly])

  const groups = useMemo(() => buildGroups(filtered), [filtered])

  function handleToggleAdmin(userId: string, currentIsAdmin: boolean) {
    const prev = items
    setItems(items.map((u) => (u.id === userId ? { ...u, is_admin: !currentIsAdmin } : u)))
    setError(null)

    startTransition(async () => {
      const result = await toggleAdmin(userId)
      if (!result.success) {
        setItems(prev)
        setError(result.error)
      }
    })
  }

  function handleToggleBeta(userId: string, currentIsBeta: boolean) {
    const prev = items
    setItems(items.map((u) => (u.id === userId ? { ...u, is_beta_tester: !currentIsBeta } : u)))
    setError(null)

    startTransition(async () => {
      const result = await toggleBetaTester(userId)
      if (!result.success) {
        setItems(prev)
        setError(result.error)
      }
    })
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'var(--apex-surface)',
        border: '1px solid var(--apex-border)',
      }}
    >
      {/* Toolbar */}
      <div style={{ borderBottom: '1px solid var(--apex-border)' }}>
        {/* Row 1: Search */}
        <div className="px-5 pt-4 pb-2">
          <div className="relative">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--apex-text-muted)' }}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по имени или email..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl text-[13px] outline-none transition-colors"
              style={{
                background: 'var(--apex-bg)',
                border: '1px solid var(--apex-border)',
                color: 'var(--apex-text)',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--apex-focus)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--apex-border)' }}
            />
          </div>
        </div>

        {/* Row 2: Filters + Actions */}
        <div className="flex items-center gap-2 px-5 pb-3 pt-1 flex-wrap">
          {/* Department filter */}
          <DeptDropdown
            value={deptFilter}
            options={departments}
            onChange={setDeptFilter}
          />

          {/* Admins only — chip toggle */}
          <button
            onClick={() => setAdminsOnly(!adminsOnly)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-colors"
            style={{
              background: adminsOnly ? 'var(--apex-success-bg)' : 'transparent',
              border: `1px solid ${adminsOnly ? 'var(--apex-primary)' : 'var(--apex-border)'}`,
              color: adminsOnly ? 'var(--apex-primary)' : 'var(--apex-text-secondary)',
            }}
          >
            {adminsOnly && <Check size={12} />}
            Только админы
          </button>

          {/* Beta only — chip toggle */}
          <button
            onClick={() => setBetaOnly(!betaOnly)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-colors"
            style={{
              background: betaOnly ? 'var(--apex-success-bg)' : 'transparent',
              border: `1px solid ${betaOnly ? 'var(--apex-primary)' : 'var(--apex-border)'}`,
              color: betaOnly ? 'var(--apex-primary)' : 'var(--apex-text-secondary)',
            }}
          >
            {betaOnly && <Check size={12} />}
            Только бета
          </button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Expand / Collapse */}
          <div
            className="flex items-center gap-0.5 px-2 py-1 rounded-full transition-colors"
            style={{
              border: '1px solid var(--apex-border)',
              color: 'var(--apex-text-muted)',
            }}
          >
            <button
              onClick={() => { setAllExpanded(false); setExpandKey((k) => k + 1) }}
              className="flex items-center justify-center w-6 h-6 rounded-full transition-colors"
              title="Свернуть все"
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--apex-primary)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'inherit' }}
            >
              <ChevronsUp size={15} />
            </button>
            <button
              onClick={() => { setAllExpanded(true); setExpandKey((k) => k + 1) }}
              className="flex items-center justify-center w-6 h-6 rounded-full transition-colors"
              title="Развернуть все"
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--apex-primary)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'inherit' }}
            >
              <ChevronsDown size={15} />
            </button>
          </div>

          {/* Count badge */}
          <span
            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg"
            style={{
              background: 'var(--apex-bg)',
              color: 'var(--apex-text-muted)',
            }}
          >
            <Users size={12} />
            {filtered.length} из {items.length}
          </span>
        </div>
      </div>

      {error && (
        <div
          className="px-5 py-2.5 text-[13px] font-medium"
          style={{
            background: 'var(--apex-error-bg)',
            color: 'var(--apex-danger)',
            borderBottom: '1px solid var(--apex-border)',
          }}
        >
          {error}
        </div>
      )}

      {/* Column headers */}
      <div
        className="flex items-center text-[11px] font-semibold uppercase tracking-wider"
        data-onboarding="admin-users-table"
        style={{
          paddingLeft: '2.5rem',
          borderBottom: '1px solid var(--apex-border)',
          color: 'var(--apex-text-muted)',
        }}
      >
        <div className="flex-1 min-w-0 px-3 py-2">Сотрудник</div>
        <div className="w-28 px-3 py-2 shrink-0 text-right">Баланс</div>
        <div className="w-24 px-3 py-2 shrink-0 text-center">Бета</div>
        <div className="w-24 px-3 py-2 shrink-0 text-center" data-onboarding="admin-users-toggle">Админ</div>
        <div className="w-8 shrink-0" />
      </div>

      {/* Grouped content */}
      <div>
        {groups.map((dept, deptIdx) => (
          <DeptSection
            key={dept.label}
            dept={dept}
            isLast={deptIdx === groups.length - 1}
            onToggleAdmin={handleToggleAdmin}
            onToggleBeta={handleToggleBeta}
            isPending={isPending}
            defaultOpen={allExpanded}
            expandKey={expandKey}
          />
        ))}
        {groups.length === 0 && (
          <div
            className="py-8 text-center text-[13px]"
            style={{ color: 'var(--apex-text-muted)' }}
          >
            Нет сотрудников по заданным фильтрам
          </div>
        )}
      </div>

      <div
        className="px-5 py-3 text-[12px] font-medium"
        style={{ color: 'var(--apex-text-muted)', borderTop: '1px solid var(--apex-border)' }}
      >
        {filtered.length} сотрудников
      </div>
    </div>
  )
}

// --- Секция отдела ---

function DeptSection({
  dept,
  isLast,
  onToggleAdmin,
  onToggleBeta,
  isPending,
  defaultOpen,
  expandKey,
}: {
  dept: DeptGroup
  isLast: boolean
  onToggleAdmin: (id: string, current: boolean) => void
  onToggleBeta: (id: string, current: boolean) => void
  isPending: boolean
  defaultOpen: boolean
  expandKey: number
}) {
  const [open, setOpen] = useState(true)

  useEffect(() => { setOpen(defaultOpen) }, [expandKey, defaultOpen])

  const count = countDeptUsers(dept)
  const hasMultipleTeams = dept.teams.length > 1 || (dept.teams.length === 1 && dept.teams[0].label !== 'Без команды')

  return (
    <div style={{ borderBottom: isLast ? 'none' : '1px solid var(--apex-border)' }}>
      {/* Заголовок отдела — левая полоска + фон */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-5 py-3 text-left transition-colors"
        style={{
          background: 'var(--apex-bg)',
          borderLeft: '4px solid var(--apex-primary)',
          borderRadius: 0,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--apex-disabled-bg)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--apex-bg)' }}
      >
        {open ? (
          <ChevronDown size={14} style={{ color: 'var(--apex-primary)' }} />
        ) : (
          <ChevronRight size={14} style={{ color: 'var(--apex-primary)' }} />
        )}
        <span
          className="text-[13px] font-bold flex-1"
          style={{ color: 'var(--apex-text)' }}
        >
          {dept.label}
        </span>
        <span
          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
          style={{
            background: 'var(--apex-success-bg)',
            color: 'var(--apex-primary)',
          }}
        >
          <Users size={11} />
          {count} сотр.
        </span>
      </button>

      {open && dept.teams.map((team) => (
        <TeamSection
          key={team.label}
          team={team}
          showHeader={hasMultipleTeams}
          onToggleAdmin={onToggleAdmin}
          onToggleBeta={onToggleBeta}
          isPending={isPending}
        />
      ))}
    </div>
  )
}

// --- Секция команды ---

function TeamSection({
  team,
  showHeader,
  onToggleAdmin,
  onToggleBeta,
  isPending,
}: {
  team: TeamGroup
  showHeader: boolean
  onToggleAdmin: (id: string, current: boolean) => void
  onToggleBeta: (id: string, current: boolean) => void
  isPending: boolean
}) {
  const [open, setOpen] = useState(true)

  return (
    <div>
      {showHeader && (
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center gap-2 pl-9 pr-5 py-2 text-left transition-colors"
          style={{
            background: 'var(--apex-surface)',
            borderTop: '1px solid var(--apex-border)',
            borderLeft: '4px solid rgba(var(--apex-primary-rgb), 0.3)',
            borderRadius: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--apex-bg)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--apex-surface)' }}
        >
          {open ? (
            <ChevronDown size={12} style={{ color: 'var(--apex-text-muted)' }} />
          ) : (
            <ChevronRight size={12} style={{ color: 'var(--apex-text-muted)' }} />
          )}
          <span
            className="text-[13px] font-bold flex-1"
            style={{ color: 'var(--apex-text)' }}
          >
            {team.label}
          </span>
          <span
            className="inline-flex items-center gap-1 text-[10px] font-medium"
            style={{ color: 'var(--apex-text-muted)' }}
          >
            <Users size={10} />
            {team.users.length}
          </span>
        </button>
      )}

      {(showHeader ? open : true) && team.users.map((user) => (
        <UserRow
          key={user.id}
          user={user}
          onToggleAdmin={() => onToggleAdmin(user.id, user.is_admin)}
          onToggleBeta={() => onToggleBeta(user.id, user.is_beta_tester)}
          isPending={isPending}
        />
      ))}
    </div>
  )
}

// --- Строка пользователя ---

function UserRow({
  user,
  onToggleAdmin,
  onToggleBeta,
  isPending,
}: {
  user: AdminUserRow
  onToggleAdmin: () => void
  onToggleBeta: () => void
  isPending: boolean
}) {
  return (
    <Link
      href={`/admin/users/${user.id}`}
      className="group flex items-center cursor-pointer transition-colors"
      style={{
        paddingLeft: '2.5rem',
        borderTop: '1px solid var(--apex-border)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--apex-bg)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
    >
      {/* Имя + email */}
      <div className="flex-1 min-w-0 px-3 py-3">
        <div
          className="text-[13px] font-semibold truncate"
          style={{ color: 'var(--apex-text)' }}
        >
          {user.last_name} {user.first_name}
        </div>
        <div
          className="text-[11px] truncate"
          style={{ color: 'var(--apex-text-muted)' }}
        >
          {user.email}
        </div>
      </div>

      {/* Баланс */}
      <div className="w-28 px-3 py-3 shrink-0 flex justify-end">
        <CoinStatic amount={user.total_coins} size="sm" />
      </div>

      {/* Бета */}
      <div
        className="w-24 px-3 py-3 shrink-0 flex justify-center"
        onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
      >
        <button
          role="switch"
          aria-checked={user.is_beta_tester}
          aria-label="Переключить бета-тестера"
          onClick={onToggleBeta}
          disabled={isPending}
          className="relative w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none"
          style={{
            background: user.is_beta_tester ? 'var(--apex-primary)' : 'var(--apex-border)',
          }}
        >
          <span
            className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
            style={{
              transform: user.is_beta_tester ? 'translateX(16px)' : 'translateX(0)',
            }}
          />
        </button>
      </div>

      {/* Роль */}
      <div
        className="w-24 px-3 py-3 shrink-0 flex justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          role="switch"
          aria-checked={user.is_admin}
          aria-label="Переключить роль админа"
          onClick={onToggleAdmin}
          disabled={isPending}
          className="relative w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none"
          style={{
            background: user.is_admin ? 'var(--apex-primary)' : 'var(--apex-border)',
          }}
        >
          <span
            className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
            style={{
              transform: user.is_admin ? 'translateX(16px)' : 'translateX(0)',
            }}
          />
        </button>
      </div>

      {/* Arrow */}
      <div className="w-8 px-2 py-3 shrink-0">
        <ChevronRight
          size={16}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: 'var(--apex-text-muted)' }}
        />
      </div>
    </Link>
  )
}

// --- Кастомный Apex Dropdown ---

function DeptDropdown({
  value,
  options,
  onChange,
}: {
  value: string
  options: string[]
  onChange: (val: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const label = value === 'all' ? 'Все отделы' : value

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-medium transition-colors"
        style={{
          background: value === 'all' ? 'var(--apex-surface)' : 'var(--apex-success-bg)',
          border: '1px solid var(--apex-border)',
          color: value === 'all' ? 'var(--apex-text-secondary)' : 'var(--apex-primary)',
        }}
      >
        <span className="truncate max-w-[180px]">{label}</span>
        {open ? (
          <ChevronUp size={14} style={{ color: 'var(--apex-text-muted)' }} />
        ) : (
          <ChevronDown size={14} style={{ color: 'var(--apex-text-muted)' }} />
        )}
      </button>

      {/* List */}
      {open && (
        <div
          className="absolute top-full left-0 mt-1.5 z-50 w-72 rounded-2xl"
          style={{
            background: 'var(--apex-surface)',
            border: '1px solid var(--apex-border)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          }}
        >
          <div className="max-h-80 overflow-y-auto my-2">
            <DropdownItem
              label="Все отделы"
              selected={value === 'all'}
              onClick={() => { onChange('all'); setOpen(false) }}
            />
            {options.map((d) => (
              <DropdownItem
                key={d}
                label={d}
                selected={value === d}
                onClick={() => { onChange(d); setOpen(false) }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function DropdownItem({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-[13px] transition-colors"
      style={{
        background: selected ? 'var(--apex-success-bg)' : 'transparent',
        color: selected ? 'var(--apex-primary)' : 'var(--apex-text)',
        fontWeight: selected ? 600 : 400,
        borderRadius: 0,
      }}
      onMouseEnter={(e) => {
        if (!selected) e.currentTarget.style.background = 'var(--apex-bg)'
      }}
      onMouseLeave={(e) => {
        if (!selected) e.currentTarget.style.background = 'transparent'
      }}
    >
      <span className="flex-1 truncate">{label}</span>
      {selected && <Check size={14} style={{ color: 'var(--apex-primary)' }} />}
    </button>
  )
}
