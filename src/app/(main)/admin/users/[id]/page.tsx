import { notFound } from 'next/navigation'
import { ArrowLeft, Coins } from 'lucide-react'
import Link from 'next/link'

import { getUserDetail } from '@/modules/admin'
import { RoleProvider, RoleBadge, RoleSwitch } from '@/modules/admin/components/RoleToggle'
import { CoinBalance, CoinStatic } from '@/components/CoinBalance'

interface UserDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function UserDetailPage({ params }: UserDetailPageProps) {
  const { id } = await params
  const detail = await getUserDetail(id)

  if (!detail) notFound()

  const { user, transactions } = detail

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

      {/* Header card */}
      <RoleProvider userId={user.id} initialIsAdmin={user.is_admin}>
        <div
          className="rounded-2xl p-6"
          style={{
            background: 'var(--apex-surface)',
            border: '1px solid var(--apex-border)',
          }}
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2
                className="text-[20px] font-bold"
                style={{ color: 'var(--apex-text)' }}
              >
                {user.last_name} {user.first_name}
              </h2>
              <p
                className="text-[13px] mt-0.5"
                style={{ color: 'var(--apex-text-muted)' }}
              >
                {user.email}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <RoleBadge />
            </div>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            <InfoCard label="Баланс" accent>
              <CoinStatic amount={user.total_coins} size="sm" />
            </InfoCard>
            <InfoCard label="Отдел">
              <span
                className="text-[13px] font-semibold"
                style={{ color: 'var(--apex-text)' }}
              >
                {user.department ?? '—'}
              </span>
            </InfoCard>
            <InfoCard label="Команда">
              <span
                className="text-[13px] font-semibold"
                style={{ color: 'var(--apex-text)' }}
              >
                {user.team ?? '—'}
              </span>
            </InfoCard>
            <InfoCard label="Роль">
              <RoleSwitch />
            </InfoCard>
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

        {transactions.length === 0 ? (
          <div
            className="py-10 text-center text-[13px]"
            style={{ color: 'var(--apex-text-muted)' }}
          >
            Нет транзакций
          </div>
        ) : (
          <div>
            {transactions.map((tx, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-5 py-3 transition-colors"
                style={{
                  borderBottom:
                    i < transactions.length - 1
                      ? '1px solid var(--apex-border)'
                      : 'none',
                }}
              >
                <div className="min-w-0 flex-1">
                  <div
                    className="text-[13px] font-medium truncate"
                    style={{ color: 'var(--apex-text)' }}
                  >
                    {tx.description ?? tx.event_type}
                  </div>
                  <div
                    className="text-[11px] mt-0.5"
                    style={{ color: 'var(--apex-text-muted)' }}
                  >
                    {tx.event_date} · {tx.source}
                  </div>
                </div>
                <div className="shrink-0 ml-4">
                  <CoinBalance amount={tx.coins} size="sm" />
                </div>
              </div>
            ))}
          </div>
        )}

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
