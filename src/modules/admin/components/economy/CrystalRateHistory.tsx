import { TrendingUp } from 'lucide-react'

import { CoinIcon } from '@/components/CoinIcon'
import type { CrystalRateRow } from '@/modules/admin'

interface CrystalRateHistoryProps {
  rates: CrystalRateRow[]
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function CrystalRateHistory({ rates }: CrystalRateHistoryProps) {
  if (rates.length === 0) return null

  const current = rates[0]
  const history = rates.slice(1)

  return (
    <section className="space-y-3" data-onboarding="admin-economy-rate">
      <h2 className="text-[14px] font-bold" style={{ color: 'var(--apex-text)' }}>
        Курс кристаллов
      </h2>

      <div
        className="rounded-2xl p-5 flex flex-col gap-4"
        style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
      >
        {/* Текущий курс */}
        <div className="flex items-center gap-3">
          <span
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--apex-success-bg)', color: 'var(--apex-primary)' }}
          >
            <TrendingUp size={16} />
          </span>
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px]" style={{ color: 'var(--apex-text-secondary)' }}>
              Текущий курс
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[20px] font-bold tabular-nums" style={{ color: 'var(--apex-text)' }}>
                {current.rate}
              </span>
              <CoinIcon size={18} />
              <span className="text-[14px] font-medium" style={{ color: 'var(--apex-text-secondary)' }}>
                = 1 BYN
              </span>
            </div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-[12px]" style={{ color: 'var(--apex-text-secondary)' }}>
              {formatDate(current.created_at)}
            </div>
            {current.set_by && (
              <div className="text-[11px]" style={{ color: 'var(--apex-text-muted)' }}>
                {current.set_by}
              </div>
            )}
          </div>
        </div>

        {/* История предыдущих курсов */}
        {history.length > 0 && (
          <div
            className="border-t pt-3 flex flex-col gap-2"
            style={{ borderColor: 'var(--apex-border)' }}
          >
            <span className="text-[11px] font-medium" style={{ color: 'var(--apex-text-secondary)' }}>
              История изменений
            </span>
            {history.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between text-[12px]"
                style={{ color: 'var(--apex-text-secondary)' }}
              >
                <div className="flex items-center gap-1.5">
                  <span className="tabular-nums font-medium" style={{ color: 'var(--apex-text)' }}>
                    {row.rate}
                  </span>
                  <CoinIcon size={12} />
                  <span>= 1 BYN</span>
                </div>
                <div className="text-right">
                  <span>{formatDate(row.created_at)}</span>
                  {row.set_by && (
                    <span className="ml-2" style={{ color: 'var(--apex-text-muted)' }}>
                      {row.set_by}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
