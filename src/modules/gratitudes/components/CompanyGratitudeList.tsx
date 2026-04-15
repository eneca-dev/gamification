'use client'

import { useState, useMemo } from 'react'
import { ArrowRight, Search } from 'lucide-react'

import { GRATITUDE_CATEGORIES } from '../types'
import type { GratitudeNew } from '../types'

function getCategoryEmoji(cat: string | null): string {
  return GRATITUDE_CATEGORIES.find((c) => c.slug === cat)?.emoji ?? '💬'
}

function getCategoryLabel(cat: string | null): string {
  return GRATITUDE_CATEGORIES.find((c) => c.slug === cat)?.label ?? 'Другое'
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins} мин. назад`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} ч. назад`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'вчера'
  if (days < 7) return `${days} дн. назад`
  return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

interface CompanyGratitudeListProps {
  items: GratitudeNew[]
  pageSize?: number
  showFilters?: boolean
}

export function CompanyGratitudeList({
  items,
  pageSize = 20,
  showFilters = true,
}: CompanyGratitudeListProps) {
  const [category, setCategory] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [visibleCount, setVisibleCount] = useState(pageSize)

  const filtered = useMemo(() => {
    let result = items
    if (category !== 'all') {
      result = result.filter((i) => i.category === category)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (i) =>
          i.sender_name.toLowerCase().includes(q) ||
          i.recipient_name.toLowerCase().includes(q)
      )
    }
    return result
  }, [items, category, search])

  const visible = filtered.slice(0, visibleCount)
  const hasMore = visibleCount < filtered.length

  return (
    <div>
      {showFilters && (
        <div className="flex flex-wrap items-center gap-1.5 mb-4">
          {/* Фильтры категорий */}
          {[
            { slug: 'all', label: 'Все' },
            ...GRATITUDE_CATEGORIES,
          ].map((cat) => (
            <button
              key={cat.slug}
              onClick={() => { setCategory(cat.slug); setVisibleCount(pageSize) }}
              className="px-3 py-1.5 rounded-full text-[12px] font-bold transition-all"
              style={{
                background: category === cat.slug ? 'var(--apex-success-bg)' : 'var(--surface-elevated)',
                color: category === cat.slug ? 'var(--apex-success-text)' : 'var(--text-muted)',
                border: category === cat.slug ? '1px solid var(--teal-100)' : '1px solid var(--border)',
              }}
            >
              {'emoji' in cat ? `${cat.emoji} ` : ''}{cat.label}
            </button>
          ))}

          {/* Поиск */}
          <div className="relative ml-auto shrink-0">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              placeholder="Имя..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setVisibleCount(pageSize) }}
              className="pl-7 pr-2 py-1.5 rounded-full text-[12px] font-medium w-32"
              style={{
                background: 'var(--surface-elevated)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
        </div>
      )}

      {/* Список */}
      {visible.length === 0 ? (
        <div
          className="rounded-2xl py-12 text-center"
          style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
        >
          <div className="text-3xl mb-3">💜</div>
          <div className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>
            Нет благодарностей
          </div>
          <div className="text-[12px] font-medium mt-1" style={{ color: 'var(--text-muted)' }}>
            За этот период благодарностей ещё не было
          </div>
        </div>
      ) : (
        <div>
          <div className="md:columns-2 gap-3 space-y-3 [column-fill:_balance]">
            {visible.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl p-4 break-inside-avoid"
                style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg"
                    style={{ background: 'var(--tag-purple-bg)' }}
                  >
                    {getCategoryEmoji(item.category)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>
                        {item.sender_name}
                      </span>
                      <ArrowRight size={12} style={{ color: 'var(--text-muted)' }} />
                      <span className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>
                        {item.recipient_name}
                      </span>
                      <span
                        className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                        style={{ background: 'var(--surface)', color: 'var(--text-muted)' }}
                      >
                        {getCategoryLabel(item.category)}
                      </span>
                    </div>
                    <div
                      className="text-[13px] font-medium mt-1.5 leading-relaxed break-all"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {item.message}
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
                        {timeAgo(item.created_at)}
                      </span>
                      {item.type === 'gift' && (
                        <span
                          className="text-[11px] font-bold px-2 py-0.5 rounded-md"
                          style={{ background: 'var(--apex-success-bg)', color: 'var(--apex-success-text)' }}
                        >
                          подарок
                        </span>
                      )}
                      {item.type === 'thanks' && (
                        <span
                          className="text-[11px] font-medium px-2 py-0.5 rounded-md"
                          style={{ background: 'var(--tag-purple-bg)', color: 'var(--tag-purple-text)' }}
                        >
                          спасибо
                        </span>
                      )}
                      {item.sender_department && (
                        <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                          {item.sender_department}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {hasMore && (
            <button
              onClick={() => setVisibleCount((c) => c + pageSize)}
              className="w-full py-3 mt-3 rounded-xl text-[13px] font-bold transition-colors"
              style={{
                background: 'var(--surface)',
                color: 'var(--text-muted)',
                border: '1px solid var(--border)',
              }}
            >
              Показать ещё ({filtered.length - visibleCount} осталось)
            </button>
          )}
        </div>
      )}
    </div>
  )
}
