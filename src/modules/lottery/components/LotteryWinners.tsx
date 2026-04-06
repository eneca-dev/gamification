import { formatLotteryMonth } from '../utils'

import type { LotteryWithStats } from '../types'

interface LotteryWinnersProps {
  lotteries: LotteryWithStats[]
}

export function LotteryWinners({ lotteries }: LotteryWinnersProps) {
  if (lotteries.length === 0) return null

  return (
    <div
      className="rounded-2xl overflow-hidden animate-fade-in-up"
      style={{ border: '1px solid var(--apex-border)' }}
    >
      <div
        className="px-5 py-3 flex items-center gap-2"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--apex-border)' }}
      >
        <span className="text-base">🏆</span>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--apex-text-primary)' }}>
          Победители розыгрышей
        </h3>
      </div>
      <div style={{ background: 'var(--surface-elevated)' }}>
        {lotteries.map((lottery) => (
          <div
            key={lottery.id}
            className="px-5 py-3 flex items-center gap-3"
            style={{ borderBottom: '1px solid var(--apex-border)' }}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium" style={{ color: 'var(--apex-text-primary)' }}>
                  {lottery.name}
                </span>
                <span
                  className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{ background: 'var(--surface)', color: 'var(--apex-text-secondary)' }}
                >
                  {formatLotteryMonth(lottery.month)}
                </span>
              </div>
              {lottery.winner && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--apex-text-secondary)' }}>
                  <span className="font-medium" style={{ color: 'var(--apex-primary)' }}>
                    {lottery.winner.first_name} {lottery.winner.last_name}
                  </span>
                  {lottery.winner.department && (
                    <span className="ml-1">· {lottery.winner.department}</span>
                  )}
                </p>
              )}
            </div>
            <div className="flex-shrink-0 text-xs" style={{ color: 'var(--apex-text-secondary)' }}>
              {lottery.total_tickets} билетов
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
