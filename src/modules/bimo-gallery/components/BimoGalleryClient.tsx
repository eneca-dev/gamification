'use client'

import { useEffect, useMemo, useOptimistic, useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronDown, ChevronRight, Heart, Search } from 'lucide-react'

import { likeBimo, unlikeBimo } from '../actions'
import { daysLeftInMonth, monthLabel } from '../month'
import { DEFAULT_GALLERY_VIEW, type GalleryEntry, type GalleryPage, type GalleryView } from '../types'
import { BimoCard } from './BimoCard'
import { BimoDetailsModal } from './BimoDetailsModal'
import { GalleryChips } from './GalleryChips'

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
  const [view, setView] = useState(initialView)
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [errorAt, setErrorAt] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)
  const [limits, setLimits] = useState<Record<string, number>>({})
  const [, startTransition] = useTransition()

  // Источник правды — данные с сервера. Клик по сердцу показывается мгновенно
  // через useOptimistic и сам откатывается, если действие не удалось.
  // Остаток лайков считает база: он учитывает голоса за тех, кто выпал из галереи.
  const [optimistic, applyLike] = useOptimistic(
    { entries: page.entries, used: page.usedLikes },
    (base, patch: { userId: string; liked: boolean }) => ({
      entries: base.entries.map((item) => (
        item.userId === patch.userId
          ? { ...item, likedByMe: patch.liked, likes: Math.max(0, item.likes + (patch.liked ? 1 : -1)) }
          : item
      )),
      used: Math.max(0, base.used + (patch.liked ? 1 : -1)),
    }),
  )
  const entries = optimistic.entries
  const used = optimistic.used
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

  useEffect(() => {
    if (!error) return
    const timer = setTimeout(() => setError(null), 4000)
    return () => clearTimeout(timer)
  }, [error, errorAt])

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

  // Отдельный счётчик нужен, чтобы повторное то же сообщение заново завело таймер.
  function showError(message: string) {
    setError(message)
    setErrorAt((value) => value + 1)
  }

  function toggleLike(entry: GalleryEntry) {
    if (busyId) return
    // Почему лайкнуть нельзя — объясняем подсказкой внизу, а не молчанием.
    if (!viewerId) {
      showError('Голосовать может только сотрудник из справочника')
      return
    }
    if (entry.userId === viewerId) {
      showError('Своего Бимо лайкнуть нельзя')
      return
    }
    if (!entry.hasLook) {
      showError('Нельзя лайкнуть: у этого Бимо нет купленных вещей')
      return
    }
    if (!entry.likedByMe && remaining === 0) {
      showError('Лайки на этот месяц закончились')
      return
    }

    setBusyId(entry.userId)
    setError(null)

    startTransition(async () => {
      applyLike({ userId: entry.userId, liked: !entry.likedByMe })
      const result = entry.likedByMe
        ? await unlikeBimo({ targetId: entry.userId })
        : await likeBimo({ targetId: entry.userId })
      setBusyId(null)
      if (!result.success) {
        // Оптимистичное состояние снимется само вместе с переходом.
        showError(result.error)
        return
      }
      // Свежие счётчики приезжают серверным рендером: действие уже
      // ревалидировало страницу, а переход держит оптимистичный вид до ответа.
      router.refresh()
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


      {podium.length > 0 && (
        <section>
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
          {/* Порядок как на пьедестале: второе место слева, первое по центру.
              При одном-двух участниках колонок столько же, сколько карточек,
              иначе пьедестал съезжает влево и остаются пустые места. */}
          <div className={`mx-auto grid max-w-[480px] justify-center gap-10 ${podium.length === 1 ? 'max-w-[160px] grid-cols-1' : podium.length === 2 ? 'max-w-[320px] grid-cols-2' : 'grid-cols-3'}`}>
            {(podium.length === 3 ? [podium[1], podium[0], podium[2]] : podium).map((entry) => (
              <BimoCard
                key={entry.userId}
                entry={entry}
                rank={ranks.get(entry.userId) ?? null}
                isViewer={entry.userId === viewerId}
                isPastWinner={pastWinners.has(entry.userId)}
                canLike={Boolean(viewerId) && entry.userId !== viewerId && entry.hasLook && (entry.likedByMe || remaining > 0)}
                isBusy={busyId === entry.userId}
                catalogArt={page.catalogArt}
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
                catalogArt={page.catalogArt}
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
          catalogArt={page.catalogArt}
          onClose={() => setOpenId(null)}
        />
      )}

      {/* Подсказка внизу экрана: почему лайк не прошёл. Гаснет сама. */}
      {error && (
        <div
          role="alert"
          className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-xl px-4 py-3 text-[13px] font-medium shadow-lg"
          style={{ background: 'var(--apex-error-bg)', color: 'var(--apex-error-text)', border: '1px solid var(--apex-danger-light)' }}
        >
          {error}
        </div>
      )}
    </div>
  )
}
