import { Trophy, Zap, ClipboardList } from 'lucide-react'
import { CoinIcon } from '@/components/CoinIcon'

import type { RankingEntry } from '@/modules/achievements/types'
import type { ContestWinner } from '@/modules/contests'

const CONTEST_COLS = [
  { type: 'revit_dept' as const, label: 'Revit • Отдел',       icon: '⚡' },
  { type: 'revit_team' as const, label: 'Revit • Команда',      icon: '⚡' },
  { type: 'ws_dept'    as const, label: 'ВС • Отдел',           icon: '📋' },
  { type: 'ws_team'    as const, label: 'ВС • Команда',         icon: '📋' },
]

function formatMonth(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-')
  const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
  return `${months[parseInt(m, 10) - 1]} ${y}`
}

function getCurrentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

interface ContestStandingsAdminProps {
  revitDeptStandings: RankingEntry[]
  revitTeamStandings: RankingEntry[]
  wsDeptStandings: RankingEntry[]
  wsTeamStandings: RankingEntry[]
  winners: ContestWinner[]
}

export function ContestStandingsAdmin({
  revitDeptStandings,
  revitTeamStandings,
  wsDeptStandings,
  wsTeamStandings,
  winners,
}: ContestStandingsAdminProps) {
  const currentMonth = getCurrentMonth()

  const currentLeaders: Record<string, RankingEntry | null> = {
    revit_dept: revitDeptStandings[0] ?? null,
    revit_team: revitTeamStandings[0] ?? null,
    ws_dept:    wsDeptStandings[0]    ?? null,
    ws_team:    wsTeamStandings[0]    ?? null,
  }

  // Уникальные месяцы из истории, отсортированные по убыванию
  const pastMonths = [...new Set(winners.map((w) => w.contestMonth))]
    .sort((a, b) => b.localeCompare(a))

  // Индекс: contestType → contestMonth → winner
  const winnerIndex: Record<string, Record<string, ContestWinner>> = {}
  for (const w of winners) {
    if (!winnerIndex[w.contestType]) winnerIndex[w.contestType] = {}
    winnerIndex[w.contestType][w.contestMonth] = w
  }

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
    >
      {/* Заголовок */}
      <div className="flex items-center gap-2 mb-5">
        <Trophy size={14} style={{ color: 'var(--orange-500)' }} />
        <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
          Конкурсы отделов и команд
        </span>
        <span className="flex items-center gap-1 text-[11px] ml-auto" style={{ color: 'var(--text-muted)' }}>
          Победитель получает +200 <CoinIcon size={10} /> каждому сотруднику
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[12px] border-collapse">
          <thead>
            <tr>
              <th
                className="text-left px-3 py-2 text-[11px] font-medium w-24"
                style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}
              >
                Месяц
              </th>
              {CONTEST_COLS.map((col) => (
                <th
                  key={col.type}
                  className="text-left px-3 py-2 text-[11px] font-medium"
                  style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}
                >
                  {col.icon} {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Текущий месяц — предварительный лидер */}
            <tr style={{ background: 'var(--apex-success-bg)' }}>
              <td className="px-3 py-2.5 font-semibold" style={{ color: 'var(--apex-primary)', borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center gap-1.5">
                  <Zap size={10} style={{ color: 'var(--apex-primary)' }} />
                  {formatMonth(currentMonth)}
                </div>
                <div className="text-[9px] font-normal mt-0.5" style={{ color: 'var(--apex-primary)', opacity: 0.7 }}>
                  сейчас
                </div>
              </td>
              {CONTEST_COLS.map((col) => {
                const leader = currentLeaders[col.type]
                return (
                  <td key={col.type} className="px-3 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
                    {leader ? (
                      <div>
                        <div className="font-semibold truncate" style={{ color: 'var(--apex-primary)' }}>
                          👑 {leader.label}
                        </div>
                        <div className="text-[10px] mt-0.5 flex items-center gap-0.5" style={{ color: 'var(--text-muted)' }}>
                          {Math.round(leader.score)} <CoinIcon size={9} />
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                )
              })}
            </tr>

            {/* История прошлых победителей */}
            {pastMonths.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  История победителей появится после первого подведения итогов (1 мая)
                </td>
              </tr>
            ) : (
              pastMonths.map((month, i) => (
                <tr
                  key={month}
                  style={{ background: i % 2 === 0 ? 'transparent' : 'var(--surface)' }}
                >
                  <td className="px-3 py-2.5 font-medium" style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
                    {formatMonth(month)}
                  </td>
                  {CONTEST_COLS.map((col) => {
                    const w = winnerIndex[col.type]?.[month]
                    return (
                      <td key={col.type} className="px-3 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
                        {w ? (
                          <div>
                            <div className="font-semibold truncate flex items-center gap-1" style={{ color: 'var(--text-primary)' }}>
                              <Trophy size={10} style={{ color: 'var(--orange-500)' }} />
                              {w.winner}
                            </div>
                            <div className="text-[10px] mt-0.5 flex items-center gap-0.5" style={{ color: 'var(--text-muted)' }}>
                              {Math.round(w.score)} <CoinIcon size={9} />
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
