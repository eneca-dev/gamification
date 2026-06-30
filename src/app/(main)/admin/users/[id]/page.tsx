import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

import { checkIsAdmin, getUserDetail } from '@/modules/admin'
import { getShieldDatesInRange } from '@/modules/streak-shield'
import { RoleProvider, RoleBadge, RoleSwitch } from '@/modules/admin/components/RoleToggle'
import { CoinStatic } from '@/components/CoinBalance'
import { StreakPanel } from '@/components/dashboard/StreakPanel'
import { getEventIcon, getTransactionDisplayDate, getUserTransactions } from '@/modules/transactions'
import { TransactionsList } from '@/modules/transactions/components/TransactionsList'
import {
  getStreakDayStatuses,
  getAutomationDays,
  getHolidays,
  getWorkdays,
  getWsStreakData,
  getRevitStreakData,
  getGridRange,
  buildCalendarDays,
} from '@/modules/streak-panel'
import type { StreakPanelData, RedReason } from '@/modules/streak-panel'

interface UserDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function UserDetailPage({ params }: UserDetailPageProps) {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) redirect('/')

  const { id } = await params
  const detail = await getUserDetail(id)

  if (!detail) notFound()

  const { user } = detail

  const { rangeStart, rangeEnd } = getGridRange()
  const [transactions, dayStatuses, automationDates, holidays, workdays, wsStreak, revitStreak, shieldDates] = await Promise.all([
    getUserTransactions(user.email, 50, 0),
    getStreakDayStatuses(user.id, rangeStart, rangeEnd),
    getAutomationDays(user.email, rangeStart, rangeEnd),
    getHolidays(rangeStart, rangeEnd),
    getWorkdays(rangeStart, rangeEnd),
    getWsStreakData(user.id),
    getRevitStreakData(user.id),
    getShieldDatesInRange(user.id, rangeStart, rangeEnd),
  ])

  const statusMap = new Map<string, { status: string; absence_type: string | null; red_reasons: RedReason[] | null }>()
  for (const row of dayStatuses) {
    statusMap.set(row.date, { status: row.status, absence_type: row.absence_type, red_reasons: row.red_reasons })
  }
  const calendarDays = buildCalendarDays(rangeStart, rangeEnd, statusMap, automationDates, holidays, workdays, shieldDates)

  const streakPanelData: StreakPanelData = {
    calendarDays,
    completedCycles: wsStreak.completedCycles,
    ws: wsStreak,
    revit: revitStreak,
  }

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Back link */}
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium transition-colors"
        style={{ color: 'var(--apex-text-muted)' }}
      >
        <ArrowLeft size={15} />
        Назад к списку
      </Link>

      <RoleProvider userId={user.id} initialIsAdmin={user.is_admin}>
        <div className="flex gap-5 items-stretch">
          {/* Left: same height as grid */}
          <div
            className="flex-1 rounded-2xl p-5 flex flex-col justify-between"
            style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[16px] font-bold" style={{ color: 'var(--apex-text)' }}>
                  {user.last_name} {user.first_name}
                </h2>
                <p className="text-[12px] mt-0.5 break-all" style={{ color: 'var(--apex-text-muted)' }}>
                  {user.email}
                </p>
              </div>
              <RoleBadge />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <InfoCard label="Баланс" accent>
                <CoinStatic amount={user.total_coins} size="sm" />
              </InfoCard>
              <InfoCard label="Отдел">
                <span className="text-[13px] font-semibold" style={{ color: 'var(--apex-text)' }}>
                  {user.department ?? '—'}
                </span>
              </InfoCard>
              <InfoCard label="Команда">
                <span className="text-[13px] font-semibold" style={{ color: 'var(--apex-text)' }}>
                  {user.team ?? '—'}
                </span>
              </InfoCard>
              <InfoCard label="Роль">
                <RoleSwitch />
              </InfoCard>
              <InfoCard label="Лучший стрик">
                <span className="text-[13px] font-semibold" style={{ color: 'var(--apex-text)' }}>
                  {wsStreak.longestStreak} дн.
                </span>
              </InfoCard>
            </div>
          </div>

          {/* Right: streak grid */}
          <div className="shrink-0 overflow-x-auto">
            <StreakPanel streakData={streakPanelData} userBalance={user.total_coins} />
          </div>
        </div>
      </RoleProvider>

      {/* Transactions */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'var(--apex-surface)',
          border: '1px solid var(--apex-border)',
        }}
      >
        <div
          className="px-5 py-3.5"
          style={{ borderBottom: '1px solid var(--apex-border)' }}
        >
          <h3
            className="text-[14px] font-bold"
            style={{ color: 'var(--apex-text)' }}
          >
            Последние транзакции
          </h3>
        </div>

        <div className="px-3 py-2">
          <TransactionsList showId items={transactions.map((tx) => ({
            ...tx,
            icon: getEventIcon(tx.event_type),
            dateFormatted: getTransactionDisplayDate(tx.event_type, tx.event_date, {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            }),
          }))} />
        </div>

        {transactions.length > 0 && (
          <div
            className="px-5 py-2.5 text-[11px] font-medium"
            style={{
              color: 'var(--apex-text-muted)',
              borderTop: '1px solid var(--apex-border)',
            }}
          >
            Показано {transactions.length} транзакций
          </div>
        )}
      </div>
    </div>
  )
}

function InfoCard({
  label,
  accent,
  children,
}: {
  label: string
  accent?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className="rounded-xl px-4 py-3"
      style={{
        background: accent ? 'var(--apex-success-bg)' : 'var(--apex-bg)',
      }}
    >
      <div
        className="text-[11px] font-medium mb-1"
        style={{ color: 'var(--apex-text-muted)' }}
      >
        {label}
      </div>
      {children}
    </div>
  )
}
