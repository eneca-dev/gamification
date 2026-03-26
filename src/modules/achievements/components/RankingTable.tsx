'use client'

import type { RankingEntry } from '../types'

interface RankingTableProps {
  title: string
  entries: RankingEntry[]
  scoreLabel?: string
  highlightId?: string
  color: string
  bg: string
}

const RANK_STYLES = [
  { bg: 'var(--tag-orange-bg)', color: 'var(--tag-orange-text)', label: '1' },
  { bg: 'var(--surface)', color: 'var(--text-secondary)', label: '2' },
  { bg: 'var(--surface)', color: 'var(--text-secondary)', label: '3' },
]

export function RankingTable({ title, entries, scoreLabel = 'Score', highlightId, color, bg }: RankingTableProps) {
  if (entries.length === 0) return null

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
    >
      <div
        className="text-[11px] font-bold uppercase tracking-wider mb-4 px-2.5 py-1 rounded-lg inline-block"
        style={{ color, background: bg }}
      >
        {title}
      </div>

      <div className="space-y-1.5">
        {entries.map((entry) => {
          const isHighlighted = highlightId === entry.entity_id
          const rankStyle = RANK_STYLES[entry.rank - 1]

          return (
            <div
              key={entry.entity_id}
              className="flex items-center gap-3 px-3 py-2 rounded-xl transition-colors"
              style={{
                background: isHighlighted ? 'var(--apex-success-bg)' : 'transparent',
                border: isHighlighted ? '1px solid var(--teal-100)' : '1px solid transparent',
              }}
            >
              {/* Ранг */}
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-extrabold flex-shrink-0"
                style={{
                  background: rankStyle?.bg ?? 'var(--surface)',
                  color: rankStyle?.color ?? 'var(--text-muted)',
                }}
              >
                {entry.rank}
              </span>

              {/* Название */}
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                  {entry.label}
                </div>
                {entry.extra && (
                  <div className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                    {entry.extra}
                  </div>
                )}
              </div>

              {/* Score */}
              <div className="text-right flex-shrink-0">
                <div className="text-[13px] font-extrabold" style={{ color: 'var(--apex-success-text)' }}>
                  {Number(entry.score).toLocaleString('ru-RU')}
                </div>
                <div className="text-[9px] font-medium uppercase" style={{ color: 'var(--text-muted)' }}>
                  {scoreLabel}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
