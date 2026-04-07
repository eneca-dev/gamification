'use client'

import { useState } from 'react'
import { Heart, Gift, BookOpen } from 'lucide-react'
import { CoinIcon } from '@/components/CoinIcon'

import type { GratitudeAchProgress } from '../types'

const CATEGORY_CONFIG: Record<string, { icon: typeof Heart; label: string; emoji: string; color: string; bg: string }> = {
  help: { icon: Heart, label: 'Помощь', emoji: '🤝', color: 'var(--apex-primary)', bg: 'var(--apex-success-bg)' },
  quality: { icon: Gift, label: 'Профессионализм', emoji: '⭐', color: 'var(--tag-orange-text)', bg: 'var(--tag-orange-bg)' },
  mentoring: { icon: BookOpen, label: 'Наставничество', emoji: '📚', color: 'var(--tag-purple-text)', bg: 'var(--tag-purple-bg)' },
}

interface GratitudeProgressProps {
  items: GratitudeAchProgress[]
  periodLabel: string
}

export function GratitudeProgressCard({ items, periodLabel }: GratitudeProgressProps) {
  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-2 mb-4">
        <Heart size={16} style={{ color: 'var(--tag-purple-text)' }} />
        <div className="text-[12px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Достижения за благодарности
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-[13px] font-medium py-4 text-center" style={{ color: 'var(--text-muted)' }}>
          Нет активных достижений
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const cfg = CATEGORY_CONFIG[item.category]
            if (!cfg) return null

            const pct = Math.min((item.current_count / item.threshold) * 100, 100)
            const remaining = Math.max(item.threshold - item.current_count, 0)

            return (
              <GratitudeAchItem
                key={item.category}
                item={item}
                cfg={cfg}
                pct={pct}
                remaining={remaining}
                periodLabel={periodLabel}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

function GratitudeAchItem({
  item,
  cfg,
  pct,
  remaining,
  periodLabel,
}: {
  item: GratitudeAchProgress
  cfg: { icon: typeof Heart; label: string; emoji: string; color: string; bg: string }
  pct: number
  remaining: number
  periodLabel: string
}) {
  const [showTip, setShowTip] = useState(false)

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold cursor-help relative"
            style={{ color: cfg.color, background: cfg.bg }}
            onMouseEnter={() => setShowTip(true)}
            onMouseLeave={() => setShowTip(false)}
          >
            <span className="text-sm">{cfg.emoji}</span>
            {item.achievement_name}
            {showTip && (
              <div
                className="absolute bottom-full left-0 mb-1.5 px-3 py-2 rounded-xl text-[11px] font-medium w-64 pointer-events-none"
                style={{
                  zIndex: 100,
                  background: 'var(--surface-elevated)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                }}
              >
                <div className="font-bold mb-1">{item.achievement_name}</div>
                <div className="text-[10px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Получите {item.threshold} подарков в категории "{cfg.label}" за месяц. Считаются только подарки (с коинами), бесплатные благодарности не учитываются.
                </div>
                <div className="text-[10px] font-semibold mt-1 inline-flex items-center gap-0.5" style={{ color: cfg.color }}>
                  Награда: +{item.bonus_coins} <CoinIcon size={10} />
                </div>
                <div
                  className="absolute top-full left-4 w-2 h-2 rotate-45"
                  style={{ background: 'var(--surface-elevated)', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}
                />
              </div>
            )}
          </span>
        </div>
        <span className="text-[12px] font-bold" style={{ color: item.earned ? 'var(--apex-success-text)' : 'var(--text-secondary)' }}>
          {item.current_count}/{item.threshold}
        </span>
      </div>

      {/* Прогресс-бар */}
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: item.earned ? 'var(--apex-primary)' : `linear-gradient(90deg, ${cfg.color}, ${cfg.color}88)`,
            minWidth: item.current_count > 0 ? '4px' : '0px',
          }}
        />
      </div>

      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] font-medium inline-flex items-center gap-0.5" style={{ color: 'var(--text-muted)' }}>
          {item.earned
            ? <>Получено! +{item.bonus_coins} <CoinIcon size={10} /></>
            : remaining > 0
              ? `Осталось ${remaining} подарков`
              : ''
          }
        </span>
        <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
          {periodLabel}
        </span>
      </div>
    </div>
  )
}
