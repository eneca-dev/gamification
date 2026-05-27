'use client'

import { useState, useTransition, useCallback } from 'react'
import { Bug, Lightbulb, Trash2, X, ChevronLeft, ChevronRight, CheckSquare, Square } from 'lucide-react'
import Link from 'next/link'

import { deleteFeedbackItems } from '@/modules/feedback/index.client'
import type { FeedbackRecord } from '@/modules/feedback/types'

interface FeedbackTableProps {
  items: FeedbackRecord[]
}

function TypeBadge({ type }: { type: FeedbackRecord['type'] }) {
  const isBug = type === 'bug'
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={isBug
        ? { background: 'color-mix(in srgb, var(--apex-danger) 12%, transparent)', color: 'var(--apex-danger)' }
        : { background: 'var(--apex-warning-muted)', color: 'var(--apex-warning-dark)' }}
    >
      {isBug ? <Bug size={11} /> : <Lightbulb size={11} />}
      {isBug ? 'Баг' : 'Предложение'}
    </span>
  )
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
      <div className="relative max-w-5xl max-h-[90vh] flex items-center" onClick={e => e.stopPropagation()}>
        {hasPrev && (
          <button
            className="absolute -left-12 p-2 rounded-full"
            style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}
            onClick={() => setIndex(i => i - 1)}
          >
            <ChevronLeft size={24} />
          </button>
        )}
        <img
          src={urls[index]}
          alt=""
          className="max-w-full max-h-[85vh] rounded-xl object-contain"
          style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}
        />
        {hasNext && (
          <button
            className="absolute -right-12 p-2 rounded-full"
            style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}
            onClick={() => setIndex(i => i + 1)}
          >
            <ChevronRight size={24} />
          </button>
        )}
        {urls.length > 1 && (
          <div
            className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs px-3 py-1 rounded-full"
            style={{ background: 'rgba(0,0,0,0.5)', color: '#fff' }}
          >
            {index + 1} / {urls.length}
          </div>
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

interface ImageThumbsProps {
  urls: string[]
  onOpen: (index: number) => void
}

function ImageThumbs({ urls, onOpen }: ImageThumbsProps) {
  if (urls.length === 0) return <span className="text-xs" style={{ color: 'var(--apex-text-muted)' }}>—</span>
  return (
    <div className="flex flex-wrap gap-1">
      {urls.map((url, i) => (
        <button
          key={i}
          onClick={() => onOpen(i)}
          className="rounded overflow-hidden flex-shrink-0 hover:opacity-80 transition-opacity"
          style={{ width: 40, height: 40, border: '1px solid var(--apex-border)' }}
        >
          <img src={url} alt="" className="w-full h-full object-cover" />
        </button>
      ))}
    </div>
  )
}

export function FeedbackTable({ items: initialItems }: FeedbackTableProps) {
  const [items, setItems] = useState(initialItems)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const allSelected = items.length > 0 && selected.size === items.length
  const someSelected = selected.size > 0

  const toggleAll = useCallback(() => {
    setSelected(allSelected ? new Set() : new Set(items.map(i => i.id)))
  }, [allSelected, items])

  const toggleOne = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const handleDelete = useCallback(() => {
    if (selected.size === 0) return
    const ids = [...selected]
    const prev = items
    setItems(items.filter(i => !selected.has(i.id)))
    setSelected(new Set())
    startTransition(async () => {
      const result = await deleteFeedbackItems(ids)
      if (!result.success) {
        setItems(prev)
        setError(result.error)
      }
    })
  }, [selected, items])

  if (items.length === 0) {
    return (
      <div
        className="rounded-2xl px-6 py-12 text-center"
        style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)', color: 'var(--apex-text-secondary)' }}
      >
        Обращений пока нет
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

      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}>
        {/* Toolbar */}
        {someSelected && (
          <div
            className="flex items-center justify-between px-5 py-3 gap-3"
            style={{ borderBottom: '1px solid var(--apex-border)', background: 'color-mix(in srgb, var(--apex-primary) 8%, var(--apex-surface))' }}
          >
            <span className="text-sm" style={{ color: 'var(--apex-text-secondary)' }}>
              Выбрано: {selected.size}
            </span>
            <button
              disabled={isPending}
              onClick={handleDelete}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-opacity"
              style={{ background: 'var(--apex-danger)', color: '#fff', opacity: isPending ? 0.6 : 1 }}
            >
              <Trash2 size={14} />
              Удалить
            </button>
          </div>
        )}

        {error && (
          <div className="px-5 py-2 text-sm" style={{ color: 'var(--apex-danger)', borderBottom: '1px solid var(--apex-border)' }}>
            {error}
          </div>
        )}

        {/* Header */}
        <div
          className="grid gap-4 px-5 py-3 text-xs font-semibold"
          style={{
            gridTemplateColumns: '32px 100px 1fr 200px 140px 100px',
            borderBottom: '1px solid var(--apex-border)',
            color: 'var(--apex-text-secondary)',
            background: 'var(--apex-bg)',
          }}
        >
          <button onClick={toggleAll} className="flex items-center" style={{ color: 'var(--apex-text-secondary)' }}>
            {allSelected ? <CheckSquare size={15} /> : <Square size={15} />}
          </button>
          <span>Тип</span>
          <span>Обращение</span>
          <span>Автор</span>
          <span>Дата</span>
          <span>Файлы</span>
        </div>

        {/* Rows */}
        {items.map((item) => (
          <div
            key={item.id}
            className="grid gap-4 items-start px-5 py-4"
            style={{
              gridTemplateColumns: '32px 100px 1fr 200px 140px 100px',
              borderBottom: '1px solid var(--apex-border)',
              background: selected.has(item.id) ? 'color-mix(in srgb, var(--apex-primary) 6%, var(--apex-surface))' : undefined,
            }}
          >
            <button
              onClick={() => toggleOne(item.id)}
              className="flex items-center pt-0.5"
              style={{ color: selected.has(item.id) ? 'var(--apex-primary)' : 'var(--apex-text-muted)' }}
            >
              {selected.has(item.id) ? <CheckSquare size={15} /> : <Square size={15} />}
            </button>

            <div className="pt-0.5">
              <TypeBadge type={item.type} />
            </div>

            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-sm font-medium" style={{ color: 'var(--apex-text)' }}>
                {item.header}
              </span>
              {item.description && (
                <span className="text-xs line-clamp-2" style={{ color: 'var(--apex-text-secondary)' }}>
                  {item.description}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-0.5 min-w-0">
              {item.user_id ? (
                <Link
                  href={`/admin/users/${item.user_id}`}
                  className="text-sm font-medium truncate hover:underline"
                  style={{ color: 'var(--apex-primary)' }}
                >
                  {item.user_name ?? '—'}
                </Link>
              ) : (
                <span className="text-sm truncate" style={{ color: 'var(--apex-text)' }}>
                  {item.user_name ?? '—'}
                </span>
              )}
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

            <span className="text-xs" style={{ color: 'var(--apex-text-secondary)' }} suppressHydrationWarning>
              {formatDate(item.created_at)}
            </span>

            <ImageThumbs
              urls={item.image_urls}
              onOpen={(index) => setLightbox({ urls: item.image_urls, index })}
            />
          </div>
        ))}

        <div className="px-5 py-3">
          <span className="text-xs" style={{ color: 'var(--apex-text-muted)' }}>
            Всего: {items.length}
          </span>
        </div>
      </div>
    </>
  )
}
