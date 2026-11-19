'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Scale, ChevronLeft, ChevronRight, X } from 'lucide-react'

import { appealStatusLabels } from '@/modules/feedback/index.client'
import type { AppealStatus, FeedbackRecord } from '@/modules/feedback/index.client'

interface AppealsTableProps {
  items: FeedbackRecord[]
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatAppealDates(dates: string[] | null): string {
  if (!dates || dates.length === 0) return '—'
  return dates
    .map((d) => {
      const [y, m, dd] = d.split('-')
      return `${dd}.${m}.${y}`
    })
    .join(', ')
}

function StatusBadge({ status }: { status: AppealStatus }) {
  const styleMap: Record<AppealStatus, { bg: string; color: string }> = {
    new: { bg: 'var(--apex-warning-muted)', color: 'var(--apex-warning-dark)' },
    approved: { bg: 'var(--apex-success-bg)', color: 'var(--apex-primary)' },
    rejected: {
      bg: 'color-mix(in srgb, var(--apex-danger) 12%, transparent)',
      color: 'var(--apex-danger)',
    },
  }
  const s = styleMap[status]
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: s.bg, color: s.color }}
    >
      {appealStatusLabels[status]}
    </span>
  )
}

interface LightboxProps {
  urls: string[]
  initialIndex: number
  onClose: () => void
}

function Lightbox({ urls, initialIndex, onClose }: LightboxProps) {
  const [index, setIndex] = useState(initialIndex)
  const hasPrev = index > 0
  const hasNext = index < urls.length - 1

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={onClose}
    >
      <div className="relative max-w-5xl max-h-[90vh] flex items-center" onClick={(e) => e.stopPropagation()}>
        {hasPrev && (
          <button
            className="absolute -left-12 p-2 rounded-full"
            style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}
            onClick={() => setIndex((i) => i - 1)}
          >
            <ChevronLeft size={24} />
          </button>
        )}
        <img src={urls[index]} alt="" className="max-w-full max-h-[85vh] rounded-xl object-contain" />
        {hasNext && (
          <button
            className="absolute -right-12 p-2 rounded-full"
            style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}
            onClick={() => setIndex((i) => i + 1)}
          >
            <ChevronRight size={24} />
          </button>
        )}
      </div>
      <button
        className="fixed top-5 right-5 p-2 rounded-full"
        style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}
        onClick={onClose}
      >
        <X size={20} />
      </button>
    </div>
  )
}

const FILTERS: Array<{ key: 'all' | AppealStatus; label: string }> = [
  { key: 'all', label: 'Все' },
  { key: 'new', label: 'Новые' },
  { key: 'approved', label: 'Одобренные' },
  { key: 'rejected', label: 'Отклонённые' },
]

export function AppealsTable({ items }: AppealsTableProps) {
  const router = useRouter()
  const [filter, setFilter] = useState<'all' | AppealStatus>('all')
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null)

  const filtered = useMemo(() => {
    if (filter === 'all') return items
    return items.filter((i) => i.status === filter)
  }, [filter, items])

  const counts = useMemo(() => {
    const c: Record<'all' | AppealStatus, number> = { all: items.length, new: 0, approved: 0, rejected: 0 }
    for (const i of items) c[i.status] = (c[i.status] ?? 0) + 1
    return c
  }, [items])

  function goToUser(appeal: FeedbackRecord) {
    if (!appeal.ws_user_id) return
    router.push(`/admin/corrections/${appeal.ws_user_id}?from=appeal&appealId=${appeal.id}`)
  }

  if (items.length === 0) {
    return (
      <div
        className="rounded-2xl px-6 py-12 text-center"
        style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)', color: 'var(--apex-text-secondary)' }}
      >
        Обжалований пока нет
      </div>
    )
  }

  return (
    <>
      {lightbox && (
        <Lightbox
          urls={lightbox.urls}
          initialIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
            style={{
              background: filter === f.key ? 'var(--apex-primary)' : 'transparent',
              color: filter === f.key ? '#fff' : 'var(--apex-text-secondary)',
              border: `1px solid ${filter === f.key ? 'var(--apex-primary)' : 'var(--apex-border)'}`,
            }}
          >
            {f.label} <span style={{ opacity: 0.7 }}>({counts[f.key]})</span>
          </button>
        ))}
      </div>

      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
      >
        {/* Header */}
        <div
          className="grid gap-3 px-5 py-3 text-xs font-semibold"
          style={{
            gridTemplateColumns: '110px 1fr 180px 140px 110px 110px 100px',
            borderBottom: '1px solid var(--apex-border)',
            color: 'var(--apex-text-secondary)',
            background: 'var(--apex-bg)',
          }}
        >
          <span>Статус</span>
          <span>Автор</span>
          <span>Дни</span>
          <span>Описание</span>
          <span>Сумма</span>
          <span>Подача</span>
          <span>Файлы</span>
        </div>

        {/* Rows */}
        {filtered.map((item) => {
          const hasNavigation = Boolean(item.ws_user_id)
          return (
            <div
              key={item.id}
              onClick={() => hasNavigation && goToUser(item)}
              className="grid gap-3 items-start px-5 py-4 transition-colors"
              style={{
                gridTemplateColumns: '110px 1fr 180px 140px 110px 110px 100px',
                borderBottom: '1px solid var(--apex-border)',
                cursor: hasNavigation ? 'pointer' : 'default',
              }}
              onMouseEnter={(e) => {
                if (hasNavigation) e.currentTarget.style.background = 'var(--apex-bg)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <div><StatusBadge status={item.status} /></div>

              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-sm font-medium truncate" style={{ color: 'var(--apex-text)' }}>
                  {item.user_name ?? '—'}
                </span>
                {item.user_email && (
                  <span className="text-xs truncate" style={{ color: 'var(--apex-text-secondary)' }}>
                    {item.user_email}
                  </span>
                )}
                {item.user_department && (
                  <span className="text-xs truncate" style={{ color: 'var(--apex-text-muted)' }}>
                    {item.user_department}{item.user_team ? ` · ${item.user_team}` : ''}
                  </span>
                )}
              </div>

              <div className="text-xs flex flex-col gap-0.5" style={{ color: 'var(--apex-text)' }}>
                {item.appeal_dates && item.appeal_dates.length > 0 && (
                  <span>{formatAppealDates(item.appeal_dates)}</span>
                )}
                {item.appeal_transaction_ids && item.appeal_transaction_ids.length > 0 && (
                  <span className="text-[11px]" style={{ color: 'var(--apex-text-muted)' }}>
                    + {item.appeal_transaction_ids.length} оп.
                  </span>
                )}
                {(!item.appeal_dates || item.appeal_dates.length === 0) &&
                 (!item.appeal_transaction_ids || item.appeal_transaction_ids.length === 0) && (
                  <span style={{ color: 'var(--apex-text-muted)' }}>—</span>
                )}
              </div>

              <span className="text-xs line-clamp-3" style={{ color: 'var(--apex-text-secondary)' }}>
                {item.description ?? '—'}
              </span>

              <span
                className="text-xs font-semibold"
                style={{ color: (item.appeal_total_coins ?? 0) < 0 ? 'var(--apex-danger)' : 'var(--apex-text-muted)' }}
              >
                {item.appeal_total_coins != null ? `${item.appeal_total_coins.toLocaleString('ru-RU')} 💎` : '—'}
              </span>

              <span className="text-xs" style={{ color: 'var(--apex-text-secondary)' }} suppressHydrationWarning>
                {formatDate(item.created_at)}
              </span>

              <div onClick={(e) => e.stopPropagation()}>
                {item.image_urls.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {item.image_urls.slice(0, 3).map((url, i) => (
                      <button
                        key={i}
                        onClick={() => setLightbox({ urls: item.image_urls, index: i })}
                        className="rounded overflow-hidden flex-shrink-0 hover:opacity-80 transition-opacity"
                        style={{ width: 32, height: 32, border: '1px solid var(--apex-border)' }}
                      >
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                    {item.image_urls.length > 3 && (
                      <span className="text-[10px] flex items-center" style={{ color: 'var(--apex-text-muted)' }}>
                        +{item.image_urls.length - 3}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-xs" style={{ color: 'var(--apex-text-muted)' }}>—</span>
                )}
              </div>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="px-5 py-10 text-center text-sm" style={{ color: 'var(--apex-text-muted)' }}>
            Нет обжалований в этом статусе
          </div>
        )}

        <div className="px-5 py-3 flex items-center gap-2">
          <Scale size={13} style={{ color: 'var(--apex-text-muted)' }} />
          <span className="text-xs" style={{ color: 'var(--apex-text-muted)' }}>
            Показано: {filtered.length} из {items.length}
          </span>
        </div>
      </div>
    </>
  )
}
