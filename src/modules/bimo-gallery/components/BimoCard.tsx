'use client'

import { Crown, Heart } from 'lucide-react'

import { bimoLook } from '@/modules/profile-appearance/index.client'

import { BimoThumb } from './BimoThumb'
import type { GalleryEntry } from '../types'

const RANK_BADGES = ['🥇', '🥈', '🥉'] as const

interface BimoCardProps {
  entry: GalleryEntry
  /** Место в рейтинге месяца; бейдж показываем только для первых трёх. */
  rank: number | null
  isViewer: boolean
  isPastWinner: boolean
  canLike: boolean
  isBusy: boolean
  onToggleLike: (entry: GalleryEntry) => void
  onOpen: (entry: GalleryEntry) => void
}

export function BimoCard({
  entry, rank, isViewer, isPastWinner, canLike, isBusy, onToggleLike, onOpen,
}: BimoCardProps) {
  const name = [entry.lastName, entry.firstName].filter(Boolean).join(' ') || 'Без имени'
  const place = [entry.department, entry.team].filter(Boolean).join(' · ')
  const badge = rank !== null && rank <= 3 ? RANK_BADGES[rank - 1] : null

  return (
    <div
      className="flex flex-col rounded-2xl p-2 transition-colors"
      style={{
        background: 'var(--apex-surface)',
        border: isViewer ? '1px solid var(--apex-primary)' : '1px solid var(--apex-border)',
      }}
    >
      <button
        type="button"
        onClick={() => onOpen(entry)}
        title="Показать Бимо крупнее"
        className="relative block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--apex-focus)]"
      >
        <BimoThumb look={bimoLook(entry.equipment)} alt={`Бимо · ${name}`} className="rounded-xl" />
        {badge && (
          <span
            className="absolute left-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[13px] leading-none"
            style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
            title={`${rank}-е место месяца`}
          >
            {badge}
          </span>
        )}
        {isPastWinner && (
          <span
            className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full"
            style={{ background: 'var(--apex-warning-bg)', color: 'var(--apex-warning-dark)' }}
            title="Побеждал в конкурсе Бимо"
          >
            <Crown size={12} />
          </span>
        )}
      </button>

      <div className="mt-2 flex items-end gap-1.5 px-1 pb-1">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-semibold" style={{ color: 'var(--apex-text)' }}>
            {name}
            {isViewer && <span style={{ color: 'var(--apex-text-muted)' }}> · вы</span>}
          </div>
          <div className="truncate text-[11px]" style={{ color: 'var(--apex-text-muted)' }}>
            {place || '—'}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onToggleLike(entry)}
          disabled={!canLike || isBusy}
          aria-pressed={entry.likedByMe}
          aria-label={entry.likedByMe ? `Снять лайк с Бимо ${name}` : `Лайкнуть Бимо ${name}`}
          title={
            isViewer ? 'Своего Бимо лайкнуть нельзя'
              : !entry.hasLook ? 'У этого Бимо ещё нет образа'
                : entry.likedByMe ? 'Снять лайк'
                  : canLike ? 'Поставить лайк' : 'Лайки на этот месяц закончились'
          }
          className="flex flex-shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[12px] font-bold transition-colors disabled:cursor-default focus-visible:outline-2 focus-visible:outline-[var(--apex-focus)]"
          style={{
            background: entry.likedByMe ? 'var(--apex-error-bg)' : 'var(--apex-bg)',
            color: entry.likedByMe ? 'var(--apex-danger)' : 'var(--apex-text-secondary)',
            border: '1px solid var(--apex-border)',
            opacity: isBusy ? 0.6 : 1,
          }}
        >
          <Heart size={13} fill={entry.likedByMe ? 'currentColor' : 'none'} />
          {entry.likes}
        </button>
      </div>
    </div>
  )
}
