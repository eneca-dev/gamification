import { Bug, Lightbulb, ExternalLink } from 'lucide-react'

import type { FeedbackRecord } from '@/modules/feedback/types'

interface FeedbackTableProps {
  items: FeedbackRecord[]
}

function TypeBadge({ type }: { type: FeedbackRecord['type'] }) {
  const isBug = type === 'bug'
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={isBug ? {
        background: '#FEE2E2',
        color: '#991B1B',
      } : {
        background: '#FEF9C3',
        color: '#854D0E',
      }}
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

export function FeedbackTable({ items }: FeedbackTableProps) {
  if (items.length === 0) {
    return (
      <div
        className="rounded-2xl px-6 py-12 text-center"
        style={{
          background: 'var(--apex-surface)',
          border: '1px solid var(--apex-border)',
          color: 'var(--apex-text-secondary)',
        }}
      >
        Обращений пока нет
      </div>
    )
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'var(--apex-surface)',
        border: '1px solid var(--apex-border)',
      }}
    >
      {/* Table header */}
      <div
        className="grid grid-cols-[100px_1fr_160px_140px_80px] gap-4 px-5 py-3 text-xs font-semibold"
        style={{
          borderBottom: '1px solid var(--apex-border)',
          color: 'var(--apex-text-secondary)',
          background: 'var(--apex-bg)',
        }}
      >
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
          className="grid grid-cols-[100px_1fr_160px_140px_80px] gap-4 items-start px-5 py-4"
          style={{ borderBottom: '1px solid var(--apex-border)' }}
        >
          <div className="pt-0.5">
            <TypeBadge type={item.type} />
          </div>

          <div className="flex flex-col gap-0.5 min-w-0">
            <span
              className="text-sm font-medium truncate"
              style={{ color: 'var(--apex-text)' }}
            >
              {item.header}
            </span>
            {item.description && (
              <span
                className="text-xs line-clamp-2"
                style={{ color: 'var(--apex-text-secondary)' }}
              >
                {item.description}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-sm truncate" style={{ color: 'var(--apex-text)' }}>
              {item.user_name ?? '—'}
            </span>
            {item.user_department && (
              <span className="text-xs truncate" style={{ color: 'var(--apex-text-muted)' }}>
                {item.user_department}
              </span>
            )}
          </div>

          <span className="text-xs" style={{ color: 'var(--apex-text-secondary)' }}>
            {formatDate(item.created_at)}
          </span>

          <div className="flex flex-col gap-1">
            {item.image_urls.length > 0 ? (
              item.image_urls.map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs"
                  style={{ color: 'var(--apex-primary)' }}
                >
                  <ExternalLink size={11} />
                  Файл {i + 1}
                </a>
              ))
            ) : (
              <span className="text-xs" style={{ color: 'var(--apex-text-muted)' }}>—</span>
            )}
          </div>
        </div>
      ))}

      <div className="px-5 py-3">
        <span className="text-xs" style={{ color: 'var(--apex-text-muted)' }}>
          Всего: {items.length}
        </span>
      </div>
    </div>
  )
}
