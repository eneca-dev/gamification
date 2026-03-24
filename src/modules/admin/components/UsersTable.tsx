'use client'

import { useState, useTransition, useMemo, useEffect } from 'react'
import { Search, ChevronRight, ChevronDown, ChevronsUp, ChevronsDown } from 'lucide-react'

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
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="px-4 py-2 rounded-lg text-[13px] font-medium outline-none cursor-pointer appearance-none pr-8"
          style={{
            background: 'var(--apex-bg)',
            border: '1px solid var(--apex-border)',
            color: deptFilter === 'all' ? 'var(--apex-text-secondary)' : 'var(--apex-text)',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 10px center',
          }}
        >
          <option value="all">Все отделы</option>
          {departments.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

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
            Только админы
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
      <div className="p-4 space-y-3">
        {groups.map((dept) => (
          <DeptSection
            key={dept.label}
            dept={dept}
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
  onSelectUser,
  onToggleAdmin,
  isPending,
  defaultOpen,
  expandKey,
}: {
  dept: DeptGroup
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
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: '1px solid var(--apex-border)' }}
    >
      {/* Заголовок отдела */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors"
        style={{
          background: 'var(--apex-success-bg)',
          color: 'var(--apex-primary)',
          borderRadius: 0,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--apex-disabled-bg)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--apex-success-bg)' }}
      >
        {open ? (
          <ChevronDown size={14} style={{ color: 'var(--apex-primary)' }} />
        ) : (
          <ChevronRight size={14} style={{ color: 'var(--apex-primary)' }} />
        )}
        <span className="text-[13px] font-bold">
          {dept.label}
        </span>
        <span
          className="text-[11px] font-semibold px-2 py-0.5"
          style={{
            background: 'var(--apex-primary)',
            color: 'white',
            borderRadius: 0,
          }}
        >
          {count}
        </span>
      </button>

      {open && (
        <div className="p-3 space-y-2" style={{ background: 'var(--apex-bg)' }}>
          {dept.teams.map((team) => (
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
      )}
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
    <div
      className="rounded-lg overflow-hidden"
      style={{
        border: showHeader ? '1px solid var(--apex-border)' : 'none',
        background: 'var(--apex-surface)',
      }}
    >
      {showHeader && (
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center gap-2 px-4 py-2 text-left transition-colors"
          style={{
            background: 'var(--apex-success-bg)',
            borderBottom: open ? '1px solid var(--apex-border)' : 'none',
            borderRadius: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--apex-disabled-bg)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--apex-success-bg)' }}
        >
          {open ? (
            <ChevronDown size={12} style={{ color: 'var(--apex-primary)' }} />
          ) : (
            <ChevronRight size={12} style={{ color: 'var(--apex-primary)' }} />
          )}
          <span
            className="text-[12px] font-semibold"
            style={{ color: 'var(--apex-text)' }}
          >
            {team.label}
          </span>
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5"
            style={{
              background: 'var(--apex-surface)',
              color: 'var(--apex-text-muted)',
              border: '1px solid var(--apex-border)',
              borderRadius: 0,
            }}
          >
            {team.users.length}
          </span>
        </button>
      )}

      {(showHeader ? open : true) && team.users.map((user, i) => (
        <UserRow
          key={user.id}
          user={user}
          isLast={i === team.users.length - 1}
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
  isLast,
  onSelect,
  onToggleAdmin,
  isPending,
}: {
  user: AdminUserRow
  isLast?: boolean
  onSelect: () => void
  onToggleAdmin: () => void
  isPending: boolean
}) {
  return (
    <div
      className="group flex items-center cursor-pointer transition-colors"
      style={{ paddingLeft: '1rem', borderBottom: isLast ? 'none' : '1px solid var(--apex-border)' }}
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
