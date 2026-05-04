'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import {
  X, Award, ShoppingBag, Ticket, Shield, Heart, AlertTriangle,
} from 'lucide-react'

import { CoinStatic } from '@/components/CoinBalance'
import type { TopRow } from '@/modules/admin'

export type TopIconName = 'award' | 'shoppingBag' | 'ticket' | 'shield' | 'heart' | 'alertTriangle'

const ICON_MAP: Record<TopIconName, React.ComponentType<{ size?: number }>> = {
  award: Award,
  shoppingBag: ShoppingBag,
  ticket: Ticket,
  shield: Shield,
  heart: Heart,
  alertTriangle: AlertTriangle,
}

interface TopListProps {
  title: string
  items: TopRow[]
  iconName: TopIconName
  secondaryLabel?: string
}

const PREVIEW_LIMIT = 10

export function TopList({ title, items, iconName, secondaryLabel }: TopListProps) {
  const Icon = ICON_MAP[iconName]
  const [modalOpen, setModalOpen] = useState(false)
  const preview = items.slice(0, PREVIEW_LIMIT)
  const hasMore = items.length > PREVIEW_LIMIT

  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3"
      style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
    >
      <div className="flex items-center gap-2">
        <span
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--apex-bg)', color: 'var(--apex-text-secondary)' }}
        >
          <Icon size={14} />
        </span>
        <h3 className="text-[13px] font-bold" style={{ color: 'var(--apex-text)' }}>
          {title}
        </h3>
      </div>

      {preview.length === 0 ? (
        <div
          className="text-[12px] py-6 text-center"
          style={{ color: 'var(--apex-text-muted)' }}
        >
          Нет данных за период
        </div>
      ) : (
        <ol className="flex flex-col gap-1">
          {preview.map((item, idx) => (
            <TopRowView key={item.id} rank={idx + 1} item={item} secondaryLabel={secondaryLabel} />
          ))}
        </ol>
      )}

      {hasMore && (
        <button
          onClick={() => setModalOpen(true)}
          className="self-start text-[12px] font-semibold"
          style={{ color: 'var(--apex-primary)' }}
        >
          Показать всех ({items.length}) →
        </button>
      )}

      {modalOpen && (
        <TopListModal
          title={title}
          items={items}
          secondaryLabel={secondaryLabel}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  )
}

interface TopRowViewProps {
  rank: number
  item: TopRow
  secondaryLabel?: string
}

function TopRowView({ rank, item, secondaryLabel }: TopRowViewProps) {
  return (
    <li
      className="flex items-center gap-2.5 py-1.5"
      style={{ borderBottom: '1px solid var(--apex-border)' }}
    >
      <span
        className="w-5 text-[11px] font-bold tabular-nums shrink-0"
        style={{ color: 'var(--apex-text-muted)' }}
      >
        {rank}
      </span>
      <span
        className="flex-1 text-[12px] font-medium truncate"
        style={{ color: 'var(--apex-text)' }}
      >
        {item.name}
      </span>
      {item.secondary !== null && secondaryLabel && (
        <span className="text-[11px] tabular-nums shrink-0" style={{ color: 'var(--apex-text-muted)' }}>
          {item.secondary} {secondaryLabel}
        </span>
      )}
      <span className="shrink-0" style={{ color: 'var(--apex-text)' }}>
        <CoinStatic amount={item.value} size="sm" />
      </span>
    </li>
  )
}

interface TopListModalProps {
  title: string
  items: TopRow[]
  secondaryLabel?: string
  onClose: () => void
}

function TopListModal({ title, items, secondaryLabel, onClose }: TopListModalProps) {
  const modalContent = (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.15)', backdropFilter: 'blur(4px)', zIndex: 9999 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
        style={{
          background: 'var(--apex-surface)',
          border: '1px solid var(--apex-border)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
        }}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: '1px solid var(--apex-border)' }}>
          <h2 className="text-[15px] font-extrabold" style={{ color: 'var(--apex-text)' }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors hover:bg-[var(--apex-bg)]"
          >
            <X size={16} style={{ color: 'var(--apex-text-muted)' }} />
          </button>
        </div>

        <ol className="flex-1 overflow-y-auto px-5 py-3">
          {items.map((item, idx) => (
            <TopRowView key={item.id} rank={idx + 1} item={item} secondaryLabel={secondaryLabel} />
          ))}
        </ol>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
