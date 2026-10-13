'use client'

import { Flame, Zap, Medal, AlertTriangle } from 'lucide-react'

import { CoinStatic } from '@/components/CoinBalance'

import type { CorrectionUserDetail } from '../types'

interface UserStateCardProps {
  detail: CorrectionUserDetail
}

export function UserStateCard({ detail }: UserStateCardProps) {
  const { user, balance, ws_streak, revit_streak, leaderboard } = detail

  return (
    <section
      className="rounded-2xl p-4 space-y-3"
      style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-[18px] font-bold truncate" style={{ color: 'var(--apex-text)' }}>
            {user.name}
          </h2>
          <div className="text-[12px]" style={{ color: 'var(--apex-text-muted)' }}>
            {user.email} · {user.department ?? '—'} · {user.team ?? '—'}
          </div>
        </div>
        {!user.is_active ? (
          <span className="text-[11px] px-2 py-1 rounded-full" style={{ background: 'var(--apex-bg)', color: 'var(--apex-text-muted)' }}>
            Пользователь неактивен
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Metric label="Баланс" value={<CoinStatic amount={balance.current} size="sm" />} />
        <Metric
          icon={Flame}
          label="Стрик WS"
          value={<span className="text-[16px] font-bold">{ws_streak.current ?? 0}</span>}
          hint={ws_streak.start_date ? `с ${ws_streak.start_date}` : null}
        />
        <Metric
          icon={Zap}
          label="Стрик Revit"
          value={<span className="text-[16px] font-bold">{revit_streak.current ?? 0}</span>}
          hint={revit_streak.start_date ? `с ${revit_streak.start_date}` : null}
        />
        <Metric
          icon={Medal}
          label="Место в топах"
          value={
            <div className="text-[13px] font-semibold">
              WS {leaderboard.rank_ws ? `#${leaderboard.rank_ws}` : '—'}
              <br />
              Revit {leaderboard.rank_revit ? `#${leaderboard.rank_revit}` : '—'}
            </div>
          }
        />
      </div>

      {balance.delta !== 0 ? (
        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-[12px]"
          style={{ background: 'var(--apex-warning-bg)', color: 'var(--apex-warning-text)' }}
        >
          <AlertTriangle size={14} />
          Баланс {balance.current} ≠ сумма транзакций {balance.transaction_sum} (дельта {balance.delta > 0 ? '+' : ''}
          {balance.delta}). Корректировка это расхождение не трогает.
        </div>
      ) : null}

      {ws_streak.pending_reset_date ? (
        <div
          className="rounded-xl px-3 py-2 text-[12px]"
          style={{ background: 'var(--apex-info-bg)', color: 'var(--apex-info-text)' }}
        >
          WS pending: сброс запланирован на {ws_streak.pending_reset_date}, грейс до{' '}
          {ws_streak.pending_reset_expires_at
            ? new Date(ws_streak.pending_reset_expires_at).toLocaleString('ru-RU')
            : '—'}
        </div>
      ) : null}
    </section>
  )
}

function Metric({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon?: typeof Flame
  label: string
  value: React.ReactNode
  hint?: string | null
}) {
  return (
    <div
      className="rounded-xl p-3"
      style={{ background: 'var(--apex-bg)', border: '1px solid var(--apex-border)' }}
    >
      <div className="flex items-center gap-1 text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--apex-text-muted)' }}>
        {Icon ? <Icon size={11} /> : null}
        {label}
      </div>
      <div style={{ color: 'var(--apex-text)' }}>{value}</div>
      {hint ? <div className="text-[10px] mt-1" style={{ color: 'var(--apex-text-muted)' }}>{hint}</div> : null}
    </div>
  )
}
