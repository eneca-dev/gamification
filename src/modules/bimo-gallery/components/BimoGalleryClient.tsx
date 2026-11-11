'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronDown, ChevronRight, Heart, Search } from 'lucide-react'

import { likeBimo, unlikeBimo } from '../actions'
import { daysLeftInMonth, monthLabel } from '../month'
import { DEFAULT_GALLERY_VIEW, type GalleryEntry, type GalleryPage, type GalleryView } from '../types'
import { BimoCard } from './BimoCard'
import { BimoDetailsModal } from './BimoDetailsModal'
import { GalleryChips } from './GalleryChips'
import { WinnerHero } from './WinnerHero'

const GROUP_PAGE_SIZE = 48
const NO_GROUP = 'Все Бимо'

interface BimoGalleryClientProps {
  page: GalleryPage
  viewerId: string | null
  initialView: GalleryView
}

const fullName = (entry: GalleryEntry) =>
  [entry.lastName, entry.firstName].filter(Boolean).join(' ') || 'Без имени'

export function BimoGalleryClient({ page, viewerId, initialView }: BimoGalleryClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [entries, setEntries] = useState(page.entries)
  const [view, setView] = useState(initialView)
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [limits, setLimits] = useState<Record<string, number>>({})
  const [, startTransition] = useTransition()

  const used = entries.filter((entry) => entry.likedByMe).length
  const remaining = Math.max(0, page.likeLimit - used)
  const daysLeft = daysLeftInMonth(page.month)
  const pastWinners = useMemo(() => new Set(page.winners.map((winner) => winner.userId)), [page.winners])
  const byId = useMemo(() => new Map(entries.map((entry) => [entry.userId, entry])), [entries])

  // Место в рейтинге считается по всем Бимо месяца, фильтры на него не влияют.
  const ranks = useMemo(() => {
    const ranked = entries.filter((entry) => entry.likes > 0).sort((a, b) => b.likes - a.likes)
    const map = new Map<string, number>()
    let rank = 0
    let previous = -1
    ranked.forEach((entry, index) => {
      if (entry.likes !== previous) { rank = index + 1; previous = entry.likes }
      map.set(entry.userId, rank)
    })
    return map
  }, [entries])

  const podium = useMemo(
    () => entries.filter((entry) => entry.likes > 0).sort((a, b) => b.likes - a.likes).slice(0, 3),
    [entries],
  )
  const viewerRank = viewerId ? ranks.get(viewerId) ?? null : null

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const visible = entries.filter((entry) => {
      if (view.look === 'custom' && !entry.hasLook) return false
      if (!needle) return true
      return [fullName(entry), entry.department, entry.team]
        .some((field) => field?.toLowerCase().includes(needle))
    })

    const buckets = new Map<string, GalleryEntry[]>()
    for (const entry of visible) {
      const key = view.group === 'dept' ? entry.department ?? 'Без отдела'
        : view.group === 'team' ? entry.team ?? 'Без команды'
          : NO_GROUP
      const bucket = buckets.get(key)
      if (bucket) bucket.push(entry)
      else buckets.set(key, [entry])
    }

    return [...buckets.entries()]
      .map(([name, items]) => ({
        name,
        items: items.slice().sort((a, b) => (
          view.sort === 'likes'
            ? b.likes - a.likes || fullName(a).localeCompare(fullName(b), 'ru')
            : fullName(a).localeCompare(fullName(b), 'ru')
        )),
        likes: items.reduce((sum, entry) => sum + entry.likes, 0),
      }))
      .sort((a, b) => b.likes - a.likes || a.name.localeCompare(b.name, 'ru'))
  }, [entries, query, view])

  const viewerGroup = useMemo(() => {
    const viewer = viewerId ? byId.get(viewerId) : null
    if (!viewer) return null
    return view.group === 'dept' ? viewer.department : view.group === 'team' ? viewer.team : NO_GROUP
  }, [byId, view.group, viewerId])

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  // Свой отдел раскрыт, остальные свёрнуты: закрытая группа не рендерит карточки.
  const isExpanded = (name: string) => collapsed[name] ?? (name === viewerGroup || name === NO_GROUP || groups.length === 1)

  function updateView(patch: Partial<GalleryView>) {
    const next = { ...view, ...patch }
    setView(next)
    const params = new URLSearchParams()
    if (next.group !== DEFAULT_GALLERY_VIEW.group) params.set('group', next.group)
    if (next.sort !== DEFAULT_GALLERY_VIEW.sort) params.set('sort', next.sort)
    if (next.look !== DEFAULT_GALLERY_VIEW.look) params.set('look', next.look)
    const search = params.toString()
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false })
  }

  function toggleLike(entry: GalleryEntry) {
    if (!viewerId || busyId) return
    if (!entry.likedByMe && remaining === 0) {
      setError('Лайки на этот месяц закончились')
      return
    }

    const previous = entries
    const delta = entry.likedByMe ? -1 : 1
    setEntries((list) => list.map((item) => (
      item.userId === entry.userId
        ? { ...item, likedByMe: !entry.likedByMe, likes: Math.max(0, item.likes + delta) }
        : item
    )))
    setBusyId(entry.userId)
    setError(null)

    startTransition(async () => {
      const result = entry.likedByMe
        ? await unlikeBimo({ targetId: entry.userId })
        : await likeBimo({ targetId: entry.userId })
      setBusyId(null)
      if (!result.success) {
        setEntries(previous)
        setError(result.error)
        return
      }
      // Сверяем счётчик с сервером: другие могли голосовать параллельно.
      setEntries((list) => list.map((item) => (
        item.userId === entry.userId
          ? { ...item, likedByMe: result.data.liked, likes: result.data.likes }
          : item
      )))
    })
  }

  const openEntry = openId ? byId.get(openId) ?? null : null
  const totalVisible = groups.reduce((sum, group) => sum + group.items.length, 0)

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold" style={{ color: 'var(--apex-text)' }}>Бимо компании</h1>
          <p className="text-[13px]" style={{ color: 'var(--apex-text-muted)' }}>
            Рейтинг за {monthLabel(page.month)}
            {daysLeft > 0 && ` · до конца ${daysLeft} дн.`}
          </p>
        </div>

        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2"
          style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
        >
          <span className="text-[12px] font-semibold" style={{ color: 'var(--apex-text-secondary)' }}>Ваши лайки</span>
          <span className="flex items-center gap-1" aria-label={`Использовано ${used} из ${page.likeLimit}`}>
            {Array.from({ length: page.likeLimit }, (_, index) => (
              <Heart
                key={index}
                size={14}
                fill={index < used ? 'currentColor' : 'none'}
                style={{ color: index < used ? 'var(--apex-danger)' : 'var(--apex-text-muted)' }}
              />
            ))}
          </span>
          <span className="text-[12px]" style={{ color: 'var(--apex-text-muted)' }}>{used} / {page.likeLimit}</span>
        </div>
      </section>

      {error && (
        <div
          role="status"
          className="rounded-xl px-4 py-3 text-[13px] font-medium"
          style={{ background: 'var(--apex-error-bg)', color: 'var(--apex-error-text)' }}
        >
          {error}
        </div>
      )}

      <WinnerHero winners={page.winners} entries={byId} lookLabels={page.lookLabels} />

      {podium.length > 0 && (
        <section
          className="rounded-2xl p-5"
          style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
        >
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[13px] font-bold uppercase" style={{ color: 'var(--apex-text-muted)' }}>
              Подиум · {monthLabel(page.month)}
            </h2>
            {viewerRank !== null && (
              <span className="text-[12px]" style={{ color: 'var(--apex-text-secondary)' }}>
                Ваше место: {viewerRank}-е
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {podium.map((entry) => (
              <BimoCard
                key={entry.userId}
                entry={entry}
                rank={ranks.get(entry.userId) ?? null}
                isViewer={entry.userId === viewerId}
                isPastWinner={pastWinners.has(entry.userId)}
                canLike={Boolean(viewerId) && entry.userId !== viewerId && entry.hasLook && (entry.likedByMe || remaining > 0)}
                isBusy={busyId === entry.userId}
                onToggleLike={toggleLike}
                onOpen={(item) => setOpenId(item.userId)}
              />
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-wrap items-end gap-x-5 gap-y-3">
        <GalleryChips
          label="Группировка"
          value={view.group}
          options={[['dept', 'Отделы'], ['team', 'Команды'], ['none', 'Без групп']]}
          onChange={(group) => updateView({ group: group as GalleryView['group'] })}
        />
        <GalleryChips
          label="Сортировка"
          value={view.sort}
          options={[['likes', 'По лайкам'], ['name', 'По имени']]}
          onChange={(sort) => updateView({ sort: sort as GalleryView['sort'] })}
        />
        <GalleryChips
          label="Показывать"
          value={view.look}
          options={[['custom', 'С образом'], ['all', 'Всех']]}
          onChange={(look) => updateView({ look: look as GalleryView['look'] })}
        />

        <div className="ml-auto flex flex-col gap-1">
          <span
            className="px-1 text-[10px] font-semibold uppercase tracking-wide"
            style={{ color: 'var(--apex-text-muted)' }}
          >
            Поиск
          </span>
          <label
            className="flex items-center gap-2 rounded-xl px-3 py-2"
            style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
          >
            <Search size={14} style={{ color: 'var(--apex-text-muted)' }} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Имя, отдел, команда"
              className="w-[180px] bg-transparent text-[13px] outline-none"
              style={{ color: 'var(--apex-text)' }}
            />
          </label>
        </div>
      </section>

      {totalVisible === 0 ? (
        <div
          className="rounded-2xl px-6 py-16 text-center"
          style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
        >
          <p className="text-[14px] font-semibold" style={{ color: 'var(--apex-text-secondary)' }}>
            {query.trim()
              ? 'Никого не нашли по этому запросу'
              : 'Пока ни один Бимо не одет в купленные вещи'}
          </p>
          {!query.trim() && view.look === 'custom' && (
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => updateView({ look: 'all' })}
                className="rounded-xl px-4 py-2 text-[13px] font-semibold"
                style={{ background: 'var(--apex-primary)', color: 'white' }}
              >
                Показать всех
              </button>
              <Link
                href="/store?tab=bimo"
                className="rounded-xl px-4 py-2 text-[13px] font-semibold"
                style={{ background: 'var(--apex-bg)', color: 'var(--apex-text)', border: '1px solid var(--apex-border)' }}
              >
                Открыть гардероб
              </Link>
            </div>
          )}
        </div>
      ) : (
        groups.map((group) => {
          const expanded = isExpanded(group.name)
          const limit = limits[group.name] ?? GROUP_PAGE_SIZE
          const shown = group.items.slice(0, limit)
          const leader = group.items.find((entry) => entry.likes > 0)

          return (
            <section key={group.name} className="space-y-3">
              <button
                type="button"
                onClick={() => setCollapsed((state) => ({ ...state, [group.name]: !expanded }))}
                aria-expanded={expanded}
                className="flex w-full items-center gap-2 rounded-xl px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-[var(--apex-focus)]"
                style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
              >
                {expanded ? <ChevronDown size={16} style={{ color: 'var(--apex-text-muted)' }} /> : <ChevronRight size={16} style={{ color: 'var(--apex-text-muted)' }} />}
                <span className="text-[14px] font-bold" style={{ color: 'var(--apex-text)' }}>{group.name}</span>
                <span className="text-[12px]" style={{ color: 'var(--apex-text-muted)' }}>
                  {group.items.length} · {group.likes} ♥
                </span>
                {leader && group.likes > 0 && (
                  <span className="ml-auto truncate text-[12px]" style={{ color: 'var(--apex-text-secondary)' }}>
                    лидер: {fullName(leader)}
                  </span>
                )}
              </button>

              {expanded && (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                    {shown.map((entry) => (
                      <BimoCard
                        key={entry.userId}
                        entry={entry}
                        rank={ranks.get(entry.userId) ?? null}
                        isViewer={entry.userId === viewerId}
                        isPastWinner={pastWinners.has(entry.userId)}
                        canLike={Boolean(viewerId) && entry.userId !== viewerId && entry.hasLook && (entry.likedByMe || remaining > 0)}
                        isBusy={busyId === entry.userId}
                        onToggleLike={toggleLike}
                        onOpen={(item) => setOpenId(item.userId)}
                      />
                    ))}
                  </div>
                  {group.items.length > shown.length && (
                    <button
                      type="button"
                      onClick={() => setLimits((state) => ({ ...state, [group.name]: limit + GROUP_PAGE_SIZE }))}
                      className="w-full rounded-xl py-2.5 text-[13px] font-semibold"
                      style={{ background: 'var(--apex-surface)', color: 'var(--apex-text-secondary)', border: '1px solid var(--apex-border)' }}
                    >
                      Показать ещё {Math.min(GROUP_PAGE_SIZE, group.items.length - shown.length)}
                    </button>
                  )}
                </>
              )}
            </section>
          )
        })
      )}

      {openEntry && (
        <BimoDetailsModal
          entry={openEntry}
          rank={ranks.get(openEntry.userId) ?? null}
          lookLabels={page.lookLabels}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  )
}
