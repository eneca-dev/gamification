'use client'

import { useState, useTransition, useMemo } from 'react'
import { Search, Zap, CheckCircle, Heart, Trophy, Users, Building2, X, Loader2 } from 'lucide-react'
import { CoinIcon } from '@/components/CoinIcon'

import { getUserFullProgress } from '@/modules/achievements/actions'
import { ACHIEVEMENT_BONUSES } from '@/modules/achievements/types'
import type { CompanyProgressEntry, FullAchievementProgress, AchievementEntityType } from '@/modules/achievements/types'

// --- Конфиги UI ---

const AREA_UI: Record<string, { label: string; icon: typeof Zap; color: string; bg: string }> = {
  revit: { label: 'Revit', icon: Zap, color: 'var(--apex-primary)', bg: 'var(--apex-success-bg)' },
  ws: { label: 'Worksection', icon: CheckCircle, color: 'var(--apex-primary)', bg: 'var(--apex-success-bg)' },
  gratitude_help: { label: 'Помощь', icon: Heart, color: 'var(--tag-purple-text)', bg: 'var(--tag-purple-bg)' },
  gratitude_quality: { label: 'Профессионализм', icon: Heart, color: 'var(--tag-purple-text)', bg: 'var(--tag-purple-bg)' },
  gratitude_mentoring: { label: 'Наставничество', icon: Heart, color: 'var(--tag-purple-text)', bg: 'var(--tag-purple-bg)' },
}

const ENTITY_UI: Record<AchievementEntityType, { emoji: string; label: string }> = {
  user: { emoji: '🏆', label: 'Личное' },
  team: { emoji: '🛡️', label: 'Команда' },
  department: { emoji: '👑', label: 'Отдел' },
}

function getAreaUI(area: string) {
  return AREA_UI[area] ?? { label: area, icon: Zap, color: 'var(--text-muted)', bg: 'var(--surface)' }
}

// --- Компактная строка внутри подблока ---

function CompactRow({ entry, unit }: { entry: CompanyProgressEntry; unit: string }) {
  const area = getAreaUI(entry.area)
  const pct = Math.min(100, (entry.days_in_top / entry.threshold) * 100)

  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className="text-[12px] font-medium truncate flex-1 min-w-0" style={{ color: 'var(--text-primary)' }}>
        {entry.label}
      </span>
      <div className="w-16 h-1.5 rounded-full overflow-hidden shrink-0" style={{ background: 'var(--border)' }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: entry.earned ? 'var(--apex-primary)' : area.color }}
        />
      </div>
      <span className="text-[11px] font-bold w-14 text-right shrink-0" style={{ color: entry.earned ? 'var(--apex-primary)' : 'var(--text-secondary)' }}>
        {entry.days_in_top}/{entry.threshold} {unit}
      </span>
      {entry.earned ? (
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: 'var(--apex-success-bg)', color: 'var(--apex-primary)' }}>
          ✓
        </span>
      ) : (
        <span className="text-[11px] font-bold w-7 text-right shrink-0" style={{ color: area.color }}>
          −{entry.remaining}
        </span>
      )}
    </div>
  )
}

// --- Подблок (например "🏆 Личные" внутри колонки Revit) ---

function SubBlock({ emoji, title, entries, unit }: { emoji: string; title: string; entries: CompanyProgressEntry[]; unit: string }) {
  if (entries.length === 0) return null
  const sorted = [...entries].sort((a, b) => a.remaining - b.remaining)

  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-sm">{emoji}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          {title}
        </span>
      </div>
      <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
        {sorted.map((e) => (
          <CompactRow key={`${e.entity_id}:${e.area}`} entry={e} unit={unit} />
        ))}
      </div>
    </div>
  )
}

// --- Колонка области (Revit / WS / Благодарности) ---

interface ColumnConfig {
  title: string
  icon: typeof Zap
  color: string
  bg: string
  subBlocks: { emoji: string; title: string; entries: CompanyProgressEntry[]; unit: string }[]
}

function AreaColumn({ config }: { config: ColumnConfig }) {
  const Icon = config.icon
  const hasData = config.subBlocks.some((sb) => sb.entries.length > 0)

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-1.5 mb-3 pb-2" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
        <Icon size={14} style={{ color: config.color }} />
        <span className="text-[12px] font-bold" style={{ color: config.color }}>
          {config.title}
        </span>
      </div>
      {hasData ? (
        config.subBlocks.map((sb) => (
          <SubBlock key={sb.title} {...sb} />
        ))
      ) : (
        <div
          className="flex flex-col items-center justify-center py-6 gap-2 rounded-xl"
          style={{ background: 'var(--apex-bg)', border: '1px solid var(--border)' }}
        >
          <span className="text-lg">📅</span>
          <div className="text-[12px] font-medium text-center" style={{ color: 'var(--text-muted)' }}>
            Топ сброшен в начале месяца.<br />Данные появятся завтра.
          </div>
        </div>
      )}
    </div>
  )
}

// --- Блок деталей пользователя ---

function UserProgressDetail({ progress }: { progress: FullAchievementProgress }) {
  const { ranking, gratitude } = progress

  if (!ranking && gratitude.length === 0) {
    return (
      <div className="text-center py-6 text-[13px] font-medium" style={{ color: 'var(--text-muted)' }}>
        Нет данных о прогрессе для этого пользователя
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {ranking && (
        <>
          {/* Личные */}
          {ranking.personal.length > 0 && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                🏆 Личные достижения
              </div>
              <div className="space-y-2">
                {ranking.personal.map((p) => {
                  const area = getAreaUI(p.area)
                  const pct = Math.min(100, (p.days_in_top / p.threshold) * 100)
                  return (
                    <div key={p.area} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                      <area.icon size={14} style={{ color: area.color }} />
                      <span className="text-[12px] font-bold" style={{ color: area.color }}>{area.label}</span>
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: area.color }} />
                      </div>
                      <span className="text-[11px] font-bold" style={{ color: 'var(--text-secondary)' }}>
                        {p.days_in_top}/{p.threshold} дн.
                      </span>
                      {p.current_rank && (
                        <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                          #{p.current_rank}
                        </span>
                      )}
                      {p.earned && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5" style={{ background: 'var(--apex-success-bg)', color: 'var(--apex-primary)' }}>
                          +{ACHIEVEMENT_BONUSES.user} <CoinIcon size={10} />
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Командные */}
          {ranking.team_progress.length > 0 && ranking.team && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                🛡️ Команда: {ranking.team}
              </div>
              <div className="space-y-2">
                {ranking.team_progress.map((p) => {
                  const area = getAreaUI(p.area)
                  const pct = Math.min(100, (p.days_in_top / p.threshold) * 100)
                  return (
                    <div key={p.area} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                      <area.icon size={14} style={{ color: area.color }} />
                      <span className="text-[12px] font-bold" style={{ color: area.color }}>{area.label}</span>
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: area.color }} />
                      </div>
                      <span className="text-[11px] font-bold" style={{ color: 'var(--text-secondary)' }}>
                        {p.days_in_top}/{p.threshold} дн.
                      </span>
                      {p.earned && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5" style={{ background: 'var(--apex-success-bg)', color: 'var(--apex-primary)' }}>
                          +{ACHIEVEMENT_BONUSES.team} <CoinIcon size={10} />
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Отдельские */}
          {ranking.department_progress.length > 0 && ranking.department && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                👑 Отдел: {ranking.department}
              </div>
              <div className="space-y-2">
                {ranking.department_progress.map((p) => {
                  const area = getAreaUI(p.area)
                  const pct = Math.min(100, (p.days_in_top / p.threshold) * 100)
                  return (
                    <div key={p.area} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                      <area.icon size={14} style={{ color: area.color }} />
                      <span className="text-[12px] font-bold" style={{ color: area.color }}>{area.label}</span>
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: area.color }} />
                      </div>
                      <span className="text-[11px] font-bold" style={{ color: 'var(--text-secondary)' }}>
                        {p.days_in_top}/{p.threshold} дн.
                      </span>
                      {p.earned && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5" style={{ background: 'var(--apex-success-bg)', color: 'var(--apex-primary)' }}>
                          +{ACHIEVEMENT_BONUSES.department} <CoinIcon size={10} />
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Благодарности */}
      {gratitude.length > 0 && (
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
            💜 Благодарности (за месяц)
          </div>
          <div className="space-y-2">
            {gratitude.map((g) => {
              const pct = Math.min(100, (g.current_count / g.threshold) * 100)
              return (
                <div key={g.category} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <Heart size={14} style={{ color: 'var(--tag-purple-text)' }} />
                  <span className="text-[12px] font-bold" style={{ color: 'var(--tag-purple-text)' }}>{g.achievement_name}</span>
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--tag-purple-text)' }} />
                  </div>
                  <span className="text-[11px] font-bold" style={{ color: 'var(--text-secondary)' }}>
                    {g.current_count}/{g.threshold}
                  </span>
                  {g.earned && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5" style={{ background: 'var(--apex-success-bg)', color: 'var(--apex-primary)' }}>
                      +{g.bonus_coins} <CoinIcon size={10} />
                    </span>
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

// --- Основной компонент ---

interface AchievementProgressAdminProps {
  rankingProgress: CompanyProgressEntry[]
  gratitudeProgress: CompanyProgressEntry[]
  users: { id: string; name: string; department: string | null }[]
}

export function AchievementProgressAdmin({
  rankingProgress,
  gratitudeProgress,
  users,
}: AchievementProgressAdminProps) {
  const [search, setSearch] = useState('')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [userProgress, setUserProgress] = useState<FullAchievementProgress | null>(null)
  const [isPending, startTransition] = useTransition()
  const [showDropdown, setShowDropdown] = useState(false)

  // Группировка по 9 блокам
  const columns = useMemo((): ColumnConfig[] => {
    const all = [...rankingProgress, ...gratitudeProgress]
    const filter = (area: string, et: AchievementEntityType) =>
      all.filter((e) => e.area === area && e.entity_type === et)

    return [
      {
        title: 'Revit',
        icon: Zap,
        color: 'var(--apex-primary)',
        bg: 'var(--apex-success-bg)',
        subBlocks: [
          { emoji: '🏆', title: 'Личные', entries: filter('revit', 'user'), unit: 'дн.' },
          { emoji: '🛡️', title: 'Команды', entries: filter('revit', 'team'), unit: 'дн.' },
          { emoji: '👑', title: 'Отделы', entries: filter('revit', 'department'), unit: 'дн.' },
        ],
      },
      {
        title: 'Благодарности',
        icon: Heart,
        color: 'var(--tag-purple-text)',
        bg: 'var(--tag-purple-bg)',
        subBlocks: [
          { emoji: '🤝', title: 'Помощь', entries: filter('gratitude_help', 'user'), unit: '' },
          { emoji: '⭐', title: 'Профессионализм', entries: filter('gratitude_quality', 'user'), unit: '' },
          { emoji: '📚', title: 'Наставничество', entries: filter('gratitude_mentoring', 'user'), unit: '' },
        ],
      },
      {
        title: 'Worksection',
        icon: CheckCircle,
        color: 'var(--apex-primary)',
        bg: 'var(--apex-success-bg)',
        subBlocks: [
          { emoji: '🏆', title: 'Личные', entries: filter('ws', 'user'), unit: 'дн.' },
          { emoji: '🛡️', title: 'Команды', entries: filter('ws', 'team'), unit: 'дн.' },
          { emoji: '👑', title: 'Отделы', entries: filter('ws', 'department'), unit: 'дн.' },
        ],
      },
    ]
  }, [rankingProgress, gratitudeProgress])

  // Поиск пользователей
  const searchResults = useMemo(() => {
    if (!search.trim()) return []
    const q = search.toLowerCase()
    return users.filter((u) => u.name.toLowerCase().includes(q)).slice(0, 8)
  }, [search, users])

  function handleSelectUser(userId: string) {
    const user = users.find((u) => u.id === userId)
    if (user) setSearch(user.name)
    setSelectedUserId(userId)
    setShowDropdown(false)
    startTransition(async () => {
      const result = await getUserFullProgress(userId)
      setUserProgress(result)
    })
  }

  function handleClearSearch() {
    setSearch('')
    setSelectedUserId(null)
    setUserProgress(null)
    setShowDropdown(false)
  }

  return (
    <div className="space-y-6">
      {/* Блок: Прогресс к достижениям */}
      <div
        className="rounded-2xl p-5"
        style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Trophy size={14} style={{ color: 'var(--orange-500)' }} />
          <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Прогресс к достижениям за текущий месяц
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {columns.map((col) => (
            <AreaColumn key={col.title} config={col} />
          ))}
        </div>
      </div>

      {/* Блок: Поиск по пользователю */}
      <div
        className="rounded-2xl p-5"
        style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Users size={14} style={{ color: 'var(--apex-primary)' }} />
          <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Прогресс сотрудника
          </span>
        </div>

        {/* Поиск */}
        <div className="relative mb-4">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--text-muted)' }}
          />
          <input
            type="text"
            placeholder="Найти сотрудника по имени..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setSelectedUserId(null)
              setUserProgress(null)
              setShowDropdown(true)
            }}
            onFocus={() => { if (search.trim() && !selectedUserId) setShowDropdown(true) }}
            className="w-full pl-9 pr-9 py-2.5 rounded-xl text-[13px] font-medium"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          />
          {search && (
            <button
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-black/5"
            >
              <X size={14} style={{ color: 'var(--text-muted)' }} />
            </button>
          )}

          {/* Dropdown результатов */}
          {showDropdown && searchResults.length > 0 && !selectedUserId && (
            <div
              className="absolute z-20 top-full left-0 right-0 mt-1 rounded-xl overflow-hidden max-h-64 overflow-y-auto"
              style={{
                background: 'var(--surface-elevated)',
                border: '1px solid var(--border)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              }}
            >
              {searchResults.map((u) => (
                <button
                  key={u.id}
                  onClick={() => handleSelectUser(u.id)}
                  className="w-full text-left px-4 py-2.5 flex items-center justify-between transition-colors hover:bg-[rgba(var(--apex-primary-rgb),0.04)]"
                >
                  <span className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
                    {u.name}
                  </span>
                  {u.department && (
                    <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
                      {u.department}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Результат */}
        {isPending && (
          <div className="flex items-center justify-center gap-2 py-8">
            <Loader2 size={16} className="animate-spin" style={{ color: 'var(--apex-primary)' }} />
            <span className="text-[13px] font-medium" style={{ color: 'var(--text-muted)' }}>
              Загрузка...
            </span>
          </div>
        )}

        {!isPending && selectedUserId && userProgress && (
          <UserProgressDetail progress={userProgress} />
        )}

        {!isPending && !selectedUserId && (
          <div className="text-center py-6 text-[13px] font-medium" style={{ color: 'var(--text-muted)' }}>
            Начните вводить имя, чтобы найти сотрудника
          </div>
        )}
      </div>
    </div>
  )
}
