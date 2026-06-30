import { Coins, TrendingDown, TrendingUp, Gift } from 'lucide-react'

import { CoinStatic } from '@/components/CoinBalance'
import { coinsToByn, formatByn } from '@/modules/shop'
import type { EconomyOverview } from '@/modules/admin'

interface KpiSummaryProps {
  overview: EconomyOverview
  rate: number
}

interface KpiCardProps {
  label: string
  value: number
  icon: React.ComponentType<{ size?: number }>
  accent: string
  bg: string
  rate: number
  hint?: string
}

function KpiCard({ label, value, icon: Icon, accent, bg, rate, hint }: KpiCardProps) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-2"
      style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium" style={{ color: 'var(--apex-text-secondary)' }}>
          {label}
        </span>
        <span
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: bg, color: accent }}
        >
          <Icon size={16} />
        </span>
      </div>
      <div
        className="text-[24px] font-bold tabular-nums leading-tight"
        style={{ color: 'var(--apex-text)' }}
      >
        {formatByn(coinsToByn(value, rate))}
      </div>
      <span style={{ color: 'var(--apex-text-muted)' }}>
        <CoinStatic amount={value} size="sm" />
      </span>
      {hint && (
        <span className="text-[11px] leading-tight" style={{ color: 'var(--apex-text-muted)' }}>
          {hint}
        </span>
      )}
    </div>
  )
}

export function KpiSummary({ overview, rate }: KpiSummaryProps) {
  const clampedPct =
    overview.total_revoked_count > 0
      ? Math.round((overview.clamped_count / overview.total_revoked_count) * 100)
      : 0

  return (
    <section className="space-y-3" data-onboarding="admin-economy-summary">
      <h2 className="text-[14px] font-bold" style={{ color: 'var(--apex-text)' }}>
        Сводка
      </h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Заработано"
          value={overview.earned}
          icon={Coins}
          accent="var(--apex-primary)"
          bg="var(--apex-success-bg)"
          rate={rate}
        />
        <KpiCard
          label="Фактически заработано"
          value={overview.factually_earned}
          icon={TrendingUp}
          accent="var(--apex-primary)"
          bg="var(--apex-success-bg)"
          rate={rate}
          hint="С учётом отзывов"
        />
        <KpiCard
          label="Отозвано фактически"
          value={overview.revoked_actual}
          icon={TrendingDown}
          accent="var(--apex-danger)"
          bg="rgba(220, 38, 38, 0.08)"
          rate={rate}
        />
        <KpiCard
          label="Подарено компанией"
          value={overview.gifted_by_company}
          icon={Gift}
          accent="#7c3aed"
          bg="rgba(124, 58, 237, 0.08)"
          rate={rate}
        />
      </div>

      <div
        className="rounded-xl px-4 py-2.5 text-[12px]"
        style={{
          background: 'var(--apex-surface)',
          border: '1px solid var(--apex-border)',
          color: 'var(--apex-text-secondary)',
        }}
      >
        Не хватило баланса на полный штраф в{' '}
        <strong style={{ color: 'var(--apex-text)' }}>{overview.clamped_count}</strong> из{' '}
        <strong style={{ color: 'var(--apex-text)' }}>{overview.total_revoked_count}</strong>{' '}
        отзывов ({clampedPct}%) — разницу компания "подарила" сотрудникам
      </div>
    </section>
  )
}
