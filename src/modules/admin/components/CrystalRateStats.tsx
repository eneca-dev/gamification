'use client'

import { CoinIcon } from '@/components/CoinIcon'

interface RateStats {
  total: number
  active: number
  comingSoon: number
  inactive: number
  categoriesTotal: number
  withDiscount: number
  outOfStock: number
  avgPrice: number
  maxPrice: number
}

interface CrystalRateStatsProps {
  // Дата установки текущего курса — для подсчёта «держится N дней»
  ratedAt: string | null
  stats: RateStats
}

// Русское склонение «день / дня / дней»
function pluralDays(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'день'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'дня'
  return 'дней'
}

interface Tile {
  label: string
  value: number
  color?: string
  coin?: boolean
}

export function CrystalRateStats({ ratedAt, stats }: CrystalRateStatsProps) {
  const days = ratedAt
    ? Math.max(0, Math.floor((Date.now() - new Date(ratedAt).getTime()) / 86_400_000))
    : null

  const tiles: Tile[] = [
    { label: 'товаров', value: stats.total },
    { label: 'категорий', value: stats.categoriesTotal },
    { label: 'со скидкой', value: stats.withDiscount },
    { label: 'активно', value: stats.active, color: 'var(--apex-success-text)' },
    { label: 'скоро в продаже', value: stats.comingSoon, color: 'var(--apex-warning-text)' },
    { label: 'неактивно', value: stats.inactive, color: 'var(--apex-text-muted)' },
    { label: 'средняя цена', value: stats.avgPrice, coin: true },
    { label: 'самый дорогой', value: stats.maxPrice, coin: true },
  ]

  return (
    <div
      className="rounded-xl px-4 py-3 flex flex-col gap-3 lg:flex-1 min-w-0"
      style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
    >
      {days !== null && (
        <div className="flex items-baseline gap-1.5">
          <span className="text-[18px] font-bold tabular-nums leading-none" style={{ color: 'var(--apex-text)' }}>
            {days}
          </span>
          <span className="text-[12px]" style={{ color: 'var(--apex-text-secondary)' }}>
            {pluralDays(days)} без изменений курса
          </span>
        </div>
      )}

      <div
        className="grid grid-cols-3 gap-x-3 gap-y-2.5"
        style={days !== null ? { borderTop: '1px solid var(--apex-border)', paddingTop: '12px' } : undefined}
      >
        {tiles.map((tile) => (
          <div key={tile.label} className="flex flex-col gap-0.5">
            <span
              className="text-[15px] font-bold tabular-nums leading-none flex items-center gap-1"
              style={{ color: tile.color ?? 'var(--apex-text)' }}
            >
              {tile.value}
              {tile.coin && <CoinIcon size={12} />}
            </span>
            <span className="text-[10px]" style={{ color: 'var(--apex-text-muted)' }}>
              {tile.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
