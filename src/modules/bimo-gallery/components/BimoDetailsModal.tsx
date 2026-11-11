'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Heart, X } from 'lucide-react'

import { BimoPortrait, bimoLook } from '@/modules/profile-appearance/index.client'

import type { GalleryEntry } from '../types'

interface BimoDetailsModalProps {
  entry: GalleryEntry
  rank: number | null
  lookLabels: Record<string, string>
  onClose: () => void
}

/** Единственное место, где Бимо оживает: Canvas монтируется только здесь и у победителя. */
export function BimoDetailsModal({ entry, rank, lookLabels, onClose }: BimoDetailsModalProps) {
  const closeButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeButton.current?.focus()
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [onClose])

  const name = [entry.lastName, entry.firstName].filter(Boolean).join(' ') || 'Без имени'
  const place = [entry.department, entry.team].filter(Boolean).join(' · ')
  const look = [entry.equipment.outfit, entry.equipment.accessory, entry.equipment.background]
    .map((key) => (key ? lookLabels[key] ?? key : null))
    .filter((label): label is string => Boolean(label))

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Бимо сотрудника ${name}`}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'var(--apex-overlay)' }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-5"
        style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-bold" style={{ color: 'var(--apex-text)' }}>{name}</div>
            <div className="truncate text-[12px]" style={{ color: 'var(--apex-text-muted)' }}>{place || '—'}</div>
          </div>
          <button
            ref={closeButton}
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="rounded-full p-1.5 transition-colors hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-[var(--apex-focus)]"
            style={{ color: 'var(--apex-text-muted)' }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 flex justify-center">
          <BimoPortrait {...bimoLook(entry.equipment)} />
        </div>

        <div className="mt-4 flex items-center justify-between text-[12px]" style={{ color: 'var(--apex-text-secondary)' }}>
          <span className="inline-flex items-center gap-1.5 font-bold" style={{ color: 'var(--apex-danger)' }}>
            <Heart size={14} fill="currentColor" />
            {entry.likes}
          </span>
          {rank !== null && <span>{rank}-е место месяца</span>}
        </div>

        <div className="mt-2 text-[12px]" style={{ color: 'var(--apex-text-muted)' }}>
          {look.length > 0 ? `Образ: ${look.join(' · ')}` : 'Образ: базовый Бимо'}
        </div>
      </div>
    </div>,
    document.body,
  )
}
