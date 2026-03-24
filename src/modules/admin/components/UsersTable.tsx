'use client'

import { useState, useTransition, useMemo, useEffect, useRef } from 'react'
import { Search, ChevronRight, ChevronDown, ChevronsUp, ChevronsDown, ChevronUp, Check } from 'lucide-react'

import { toggleAdmin } from '@/modules/admin/index.client'

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
  onSelectUser: (userId: string) => void
}

export function UsersTable({ users, onSelectUser }: UsersTableProps) {
  const [items, setItems] = useState(users)
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('all')
  const [adminsOnly, setAdminsOnly] = useState(false)
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
  }, [items, search, deptFilter, adminsOnly])

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

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'var(--apex-surface)',
        border: '1px solid var(--apex-border)',
      }}
    >
      {/* Toolbar */}
      <div
        className="flex items-center gap-3 px-5 py-3 flex-wrap"
        style={{ borderBottom: '1px solid var(--apex-border)' }}
      >
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--apex-text-muted)' }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по имени или email"
            className="w-full pl-8 pr-3 py-2 rounded-full text-[13px] outline-none transition-colors"
            style={{
              background: 'var(--apex-bg)',
              border: '1px solid var(--apex-border)',
              color: 'var(--apex-text)',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--apex-focus)' }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--apex-border)' }}
          />
        </div>

        {/* Department filter */}
        <DeptDropdown
          value={deptFilter}
          options={departments}
          onChange={setDeptFilter}
        />

        {/* Admins only toggle */}
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <button
            role="switch"
            aria-checked={adminsOnly}
            onClick={() => setAdminsOnly(!adminsOnly)}
            className="relative w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none"
            style={{
              background: adminsOnly ? 'var(--apex-primary)' : 'var(--apex-border)',
            }}
          >
            <span
              className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
              style={{
                transform: adminsOnly ? 'translateX(16px)' : 'translateX(0)',
              }}
            />
          </button>
          <span
            className="text-[12px] font-medium select-none"
            style={{
              color: adminsOnly ? 'var(--apex-primary)' : 'var(--apex-text-muted)',
            }}
          >
            Показать только админов
          </span>
        </label>

        {/* Expand/Collapse + Count */}
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => { setAllExpanded(false); setExpandKey((k) => k + 1) }}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
            title="Свернуть все"
            style={{ color: 'var(--apex-text-muted)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--apex-bg)'
              e.currentTarget.style.color = 'var(--apex-primary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--apex-text-muted)'
            }}
          >
            <ChevronsUp size={16} />
          </button>
          <button
            onClick={() => { setAllExpanded(true); setExpandKey((k) => k + 1) }}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
            title="Развернуть все"
            style={{ color: 'var(--apex-text-muted)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--apex-bg)'
              e.currentTarget.style.color = 'var(--apex-primary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--apex-text-muted)'
            }}
          >
            <ChevronsDown size={16} />
          </button>
          <span
            className="text-[12px] font-medium"
            style={{ color: 'var(--apex-text-muted)' }}
          >
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

      {/* Grouped content */}
      <div>
        {groups.map((dept, deptIdx) => (
          <DeptSection
            key={dept.label}
            dept={dept}
            isLast={deptIdx === groups.length - 1}
            onSelectUser={onSelectUser}
            onToggleAdmin={handleToggleAdmin}
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
  onSelectUser,
  onToggleAdmin,
  isPending,
  defaultOpen,
  expandKey,
}: {
  dept: DeptGroup
  isLast: boolean
  onSelectUser: (id: string) => void
  onToggleAdmin: (id: string, current: boolean) => void
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
          className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
          style={{
            background: 'var(--apex-success-bg)',
            color: 'var(--apex-primary)',
          }}
        >
          {count}
        </span>
      </button>

      {open && dept.teams.map((team) => (
        <TeamSection
          key={team.label}
          team={team}
          showHeader={hasMultipleTeams}
          onSelectUser={onSelectUser}
          onToggleAdmin={onToggleAdmin}
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
  onSelectUser,
  onToggleAdmin,
  isPending,
}: {
  team: TeamGroup
  showHeader: boolean
  onSelectUser: (id: string) => void
  onToggleAdmin: (id: string, current: boolean) => void
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
            className="text-[10px] font-medium"
            style={{ color: 'var(--apex-text-muted)' }}
          >
            {team.users.length}
          </span>
        </button>
      )}

      {(showHeader ? open : true) && team.users.map((user) => (
        <UserRow
          key={user.id}
          user={user}
          onSelect={() => onSelectUser(user.id)}
          onToggleAdmin={() => onToggleAdmin(user.id, user.is_admin)}
          isPending={isPending}
        />
      ))}
    </div>
  )
}

// --- Строка пользователя ---

function UserRow({
  user,
  onSelect,
  onToggleAdmin,
  isPending,
}: {
  user: AdminUserRow
  onSelect: () => void
  onToggleAdmin: () => void
  isPending: boolean
}) {
  return (
    <div
      className="group flex items-center cursor-pointer transition-colors"
      style={{
        paddingLeft: '2.5rem',
        borderTop: '1px solid var(--apex-border)',
      }}
      onClick={onSelect}
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
      <div className="w-24 px-3 py-3 shrink-0 text-right">
        <span
          className="text-[14px] font-bold"
          style={{ color: 'var(--apex-success-text)' }}
        >
          {user.total_coins.toLocaleString('ru-RU')}
        </span>
      </div>

      {/* Роль */}
      <div
        className="w-32 px-3 py-3 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <button
            role="switch"
            aria-checked={user.is_admin}
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
          <span
            className="text-[12px] font-medium select-none"
            style={{
              color: user.is_admin ? 'var(--apex-primary)' : 'var(--apex-text-muted)',
            }}
          >
            Админ
          </span>
        </label>
      </div>

      {/* Arrow */}
      <div className="w-8 px-2 py-3 shrink-0">
        <ChevronRight
          size={16}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: 'var(--apex-text-muted)' }}
        />
      </div>
    </div>
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
