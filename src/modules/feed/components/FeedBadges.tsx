'use client'

import type React from 'react'
import { useState } from 'react'
import { Building2, Check, Info, Users } from 'lucide-react'

import { CoinIcon } from '@/components/CoinIcon'
import { GRATITUDE_CATEGORIES } from '@/modules/gratitudes/types'

import type { AchBreakdown, AchievementBadge, GratitudeBadge } from '../types'

// ── Конфиг достижений ─────────────────────────────────────────────────────────

const ACH_STYLE: Record<string, { color: string; earnedColor: string; baseBg: string; fillBg: string; label: string }> = {
  revit: {
    color: 'var(--orange-500)',
    earnedColor: 'var(--tag-orange-text)',
    baseBg: 'var(--tag-orange-bg)',
    fillBg: 'rgba(249,115,22,0.35)',
    label: 'Revit',
  },
  ws: {
    color: 'var(--tag-blue-text)',
    earnedColor: 'var(--tag-blue-text)',
    baseBg: 'var(--tag-blue-bg)',
    fillBg: 'rgba(29,78,216,0.30)',
    label: 'WS',
  },
  gratitude: {
    color: 'var(--tag-purple-text)',
    earnedColor: 'var(--tag-purple-text)',
    baseBg: 'var(--tag-purple-bg)',
    fillBg: 'rgba(91,33,182,0.30)',
    label: 'Благодарности',
  },
  gratitude_help: {
    color: 'var(--tag-teal-text)',
    earnedColor: 'var(--tag-teal-text)',
    baseBg: 'var(--tag-teal-bg)',
    fillBg: 'rgba(27,107,88,0.30)',
    label: 'Поддержка коллег',
  },
  gratitude_quality: {
    color: 'var(--orange-500)',
    earnedColor: 'var(--tag-orange-text)',
    baseBg: 'var(--tag-orange-bg)',
    fillBg: 'rgba(249,115,22,0.35)',
    label: 'Профессиональное признание',
  },
  gratitude_mentoring: {
    color: 'var(--tag-blue-text)',
    earnedColor: 'var(--tag-blue-text)',
    baseBg: 'var(--tag-blue-bg)',
    fillBg: 'rgba(29,78,216,0.30)',
    label: 'Наставничество',
  },
}

// ── Конфиг категорий благодарностей ──────────────────────────────────────────

const CATEGORY_COLOR: Record<string, { bg: string; color: string }> = {
  help:       { bg: 'var(--tag-teal-bg)',   color: 'var(--tag-teal-text)' },
  quality:    { bg: 'var(--tag-orange-bg)', color: 'var(--tag-orange-text)' },
  mentoring:  { bg: 'var(--tag-blue-bg)',   color: 'var(--tag-blue-text)' },
  teamwork:   { bg: 'var(--tag-purple-bg)', color: 'var(--tag-purple-text)' },
  atmosphere: { bg: 'var(--tag-yellow-bg)', color: 'var(--tag-yellow-text)' },
  other:      { bg: 'var(--tag-gray-bg)',   color: 'var(--tag-gray-text)' },
}

const CATEGORY_META = new Map<string, { emoji: string; label: string }>(
  GRATITUDE_CATEGORIES.map((c) => [c.slug, { emoji: c.emoji, label: c.label }]),
)

// ── AchBadge ─────────────────────────────────────────────────────────────────

export function AchBadge({ badge }: { badge: AchievementBadge }) {
  const s = ACH_STYLE[badge.area] ?? ACH_STYLE.gratitude
  const pct = badge.earned
    ? 100
    : badge.threshold > 0
    ? Math.max(6, Math.min(94, (badge.daysInTop / badge.threshold) * 100))
    : 0

  const bg = badge.earned
    ? s.baseBg
    : `linear-gradient(to right, ${s.fillBg} ${pct}%, ${s.baseBg} ${pct}%)`
  const color = s.earnedColor
  const border = `1px solid ${s.earnedColor}`

  return (
    <span
      title={badge.earned ? `${s.label}: получено` : `${s.label}: ${badge.daysInTop} из ${badge.threshold} дней в топе`}
      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold shrink-0 whitespace-nowrap"
      style={{ background: bg, border, color }}
    >
      {s.label}
      {badge.earned && <Check size={9} strokeWidth={3} />}
      {!badge.earned && badge.threshold > 0 && (
        <span className="opacity-65 ml-0.5">{badge.daysInTop}/{badge.threshold}</span>
      )}
    </span>
  )
}

// ── Объединённый бейдж «Благодарности» с тултипом ────────────────────────────

const GRAT_AREAS = [
  { area: 'gratitude_help',      label: 'Поддержка коллег' },
  { area: 'gratitude_quality',   label: 'Профессиональное признание' },
  { area: 'gratitude_mentoring', label: 'Наставничество' },
] as const

function GratCombinedBadge({ badges }: { badges: AchievementBadge[] }) {
  const [visible, setVisible] = useState(false)

  const earnedCount = badges.filter((b) => b.earned).length
  const total = GRAT_AREAS.length
  const allEarned = earnedCount === total
  const pct = (earnedCount / total) * 100

  const color = 'var(--tag-purple-text)'
  const baseBg = 'var(--tag-purple-bg)'
  const fillBg = 'rgba(91,33,182,0.30)'
  const bg = `linear-gradient(to right, ${fillBg} ${Math.max(6, pct)}%, ${baseBg} ${Math.max(6, pct)}%)`

  return (
    <span className="relative inline-block">
      <span
        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold cursor-default select-none"
        style={{ background: bg, border: `1px solid ${color}`, color, minWidth: '80px' }}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
      >
        Благодарности
        {allEarned
          ? <Check size={9} strokeWidth={3} />
          : <span className="opacity-65 ml-0.5">{earnedCount}/{total}</span>
        }
      </span>

      {visible && (
        <div
          className="absolute bottom-full left-0 mb-1.5 z-50 pointer-events-none"
          style={{ minWidth: '210px' }}
        >
          <div
            className="rounded-xl px-3 py-2.5 shadow-md flex flex-col gap-1.5"
            style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
          >
            {GRAT_AREAS.map(({ area, label }) => {
              const badge = badges.find((b) => b.area === area)
              const earned = badge?.earned ?? false
              const s = ACH_STYLE[area] ?? ACH_STYLE.gratitude
              const badgeColor = s.color
              const badgeBg = s.baseBg
              const badgeBorder = `1px solid ${s.color}`
              return (
                <span
                  key={area}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold"
                  style={{ background: badgeBg, color: badgeColor, border: badgeBorder, opacity: earned ? 1 : 0.65 }}
                >
                  {label}
                  {earned
                    ? <Check size={9} strokeWidth={3} />
                    : <span className="opacity-70 ml-0.5">
                        {badge?.daysInTop ?? 0}/{badge?.threshold ?? 0}
                      </span>
                  }
                </span>
              )
            })}
          </div>
        </div>
      )}
    </span>
  )
}

export function AchBadges({ badges }: { badges: AchievementBadge[] }) {
  const gratSub = badges.filter((b) => b.area.startsWith('gratitude_') && b.area !== 'gratitude')
  const rest = badges.filter((b) => !b.area.startsWith('gratitude_') || b.area === 'gratitude')

  if (rest.length === 0 && gratSub.length === 0) {
    return <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>—</span>
  }
  return (
    <span className="inline-flex flex-wrap gap-1 items-center">
      {rest.map((b) => <AchBadge key={b.area} badge={b} />)}
      {gratSub.length > 0 && <GratCombinedBadge badges={gratSub} />}
    </span>
  )
}

// ── GratBadges ────────────────────────────────────────────────────────────────

export function GratBadges({ items }: { items: GratitudeBadge[] }) {
  if (items.length === 0) {
    return <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>—</span>
  }

  const counts = new Map<string, number>()
  for (const g of items) {
    const key = g.category ?? 'other'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return (
    <span className="inline-flex flex-wrap gap-1 items-center">
      {[...counts.entries()].map(([slug, count]) => {
        const meta = CATEGORY_META.get(slug)
        const colors = CATEGORY_COLOR[slug] ?? CATEGORY_COLOR.other
        return (
          <span
            key={slug}
            title={meta?.label ?? slug}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap"
            style={{ background: colors.bg, color: colors.color }}
          >
            {meta?.emoji ?? '❤️'} {meta?.label ?? slug}
            {count > 1 && <span className="opacity-65 ml-0.5">×{count}</span>}
          </span>
        )
      })}
    </span>
  )
}

// ── CountBadge ────────────────────────────────────────────────────────────────

export function CountBadge({
  icon: Icon,
  value,
  color,
  bg,
}: {
  icon: React.ElementType
  value: number
  color: string
  bg: string
}) {
  if (value === 0) return <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>—</span>
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-bold" style={{ background: bg, color }}>
      <Icon size={11} />{value}
    </span>
  )
}

// ── InfoIcon ──────────────────────────────────────────────────────────────────

export function InfoIcon({ text }: { text: React.ReactNode }) {
  const [visible, setVisible] = useState(false)
  return (
    <span
      className="relative inline-flex cursor-help shrink-0"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <span
        className="w-4 h-4 rounded-full flex items-center justify-center"
        style={{ background: 'var(--surface)', border: '1px solid var(--apex-border)' }}
      >
        <Info size={10} style={{ color: 'var(--apex-text-muted)' }} />
      </span>
      {visible && (
        <div
          className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-2.5 rounded-xl text-[11px] font-medium w-64 pointer-events-none"
          style={{
            zIndex: 100,
            background: '#ffffff',
            color: 'var(--text-primary)',
            border: '1px solid var(--apex-border)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          }}
        >
          <div className="text-[10px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {text}
          </div>
          {/* Стрелка вверх */}
          <div
            className="absolute bottom-full left-1/2 -translate-x-1/2 w-2 h-2 rotate-45"
            style={{ background: '#ffffff', borderLeft: '1px solid var(--apex-border)', borderTop: '1px solid var(--apex-border)', marginBottom: '-1px' }}
          />
        </div>
      )}
    </span>
  )
}

// ── AchBreakdownCell ──────────────────────────────────────────────────────────

export function AchBreakdownCell({ b }: { b: AchBreakdown | undefined }) {
  if (!b) return <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>—</span>
  const total = b.user + b.team + (b.department ?? 0)
  if (total === 0) return <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>—</span>
  return (
    <span className="inline-flex flex-wrap gap-1 items-center">
      {b.user > 0 && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap"
          style={{ background: 'var(--tag-teal-bg)', color: 'var(--tag-teal-text)', border: '1px solid var(--tag-teal-text)' }}>
          <Users size={9} />личные: {b.user}
        </span>
      )}
      {b.team > 0 && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap"
          style={{ background: 'var(--tag-blue-bg)', color: 'var(--tag-blue-text)', border: '1px solid var(--tag-blue-text)' }}>
          <Users size={9} />команда: {b.team}
        </span>
      )}
      {(b.department ?? 0) > 0 && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap"
          style={{ background: 'var(--tag-purple-bg)', color: 'var(--tag-purple-text)', border: '1px solid var(--tag-purple-text)' }}>
          <Building2 size={9} />отдел: {b.department}
        </span>
      )}
    </span>
  )
}

// ── CoinCell ──────────────────────────────────────────────────────────────────

export function CoinCell({
  value,
  color,
  bg,
}: {
  value: number
  color: string
  bg: string
}) {
  return (
    <span
      className="inline-flex items-center justify-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-bold whitespace-nowrap tabular-nums"
      style={{ background: bg, color, minWidth: '40px' }}
    >
      {value.toLocaleString('ru-RU')}
      <CoinIcon size={10} />
    </span>
  )
}
