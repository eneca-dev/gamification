import { Trophy } from 'lucide-react'
import { CoinIcon } from '@/components/CoinIcon'

import type { ContestWinner } from '@/modules/contests'
import { CONTEST_LABELS } from '@/modules/contests'

interface ContestWinnersProps {
  winners: ContestWinner[]
}

function formatMonth(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-')
  const months = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь']
  return `${months[parseInt(m, 10) - 1]} ${y}`
}

function getLastMonthKey(): string {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function ContestWinners({ winners }: ContestWinnersProps) {
  const lastMonth = getLastMonthKey()
  const lastMonthWinners = winners.filter((w) => w.contestMonth === lastMonth)

  if (lastMonthWinners.length === 0) return null

  const CONTEST_ORDER: Array<'revit_dept' | 'revit_team' | 'ws_dept' | 'ws_team'> = [
    'revit_dept', 'revit_team', 'ws_dept', 'ws_team',
  ]

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-2 mb-4">
        <Trophy size={14} style={{ color: 'var(--orange-500)' }} />
        <span className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Победители прошлого месяца
        </span>
        <span
          className="ml-auto text-[10px] px-2 py-0.5 rounded-full"
          style={{ background: 'var(--orange-50)', color: 'var(--tag-orange-text)', border: '1px solid rgba(255,152,0,0.2)' }}
        >
          {formatMonth(lastMonth)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {CONTEST_ORDER.map((type) => {
          const winner = lastMonthWinners.find((w) => w.contestType === type)
          const label = CONTEST_LABELS[type]
          const isRevit = type.startsWith('revit')

          return (
            <div
              key={type}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
              style={{
                background: winner ? 'var(--surface)' : 'var(--surface)',
                border: `1px solid var(--border)`,
              }}
            >
              <span className="text-base shrink-0">{winner ? '🏆' : '—'}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {label.title}
                </div>
                <div
                  className="text-[12px] font-semibold truncate"
                  style={{ color: winner ? (isRevit ? 'var(--orange-500)' : 'var(--apex-primary)') : 'var(--text-muted)' }}
                >
                  {winner ? winner.winner : 'Нет данных'}
                </div>
              </div>
              {winner && (
                <div className="flex items-center gap-0.5 shrink-0">
                  <span className="text-[11px] font-bold" style={{ color: 'var(--text-secondary)' }}>+200</span>
                  <CoinIcon size={10} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
