'use client'

import { useEffect, useState } from 'react'
import { X, Coins } from 'lucide-react'

import type { UserDetail } from '../types'

interface UserDetailModalProps {
  userId: string | null
  onClose: () => void
}

export function UserDetailModal({ userId, onClose }: UserDetailModalProps) {
  const [detail, setDetail] = useState<UserDetail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!userId) { setDetail(null); return }

    setLoading(true)
    fetch(`/api/admin/user-detail?id=${userId}`)
      .then((r) => r.json())
      .then((data) => setDetail(data))
      .catch(() => setDetail(null))
      .finally(() => setLoading(false))
  }, [userId])

  if (!userId) return null

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20" />

      {/* Panel */}
      <div
        className="relative w-full max-w-md h-full overflow-y-auto"
        style={{ background: 'var(--apex-surface)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-6 py-4"
          style={{
            background: 'var(--apex-surface)',
            borderBottom: '1px solid var(--apex-border)',
          }}
        >
          <h2
            className="text-[16px] font-bold"
            style={{ color: 'var(--apex-text)' }}
          >
            {loading ? 'Загрузка...' : detail
              ? `${detail.user.last_name} ${detail.user.first_name}`
              : 'Не найден'}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{ color: 'var(--apex-text-muted)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--apex-bg)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {loading && (
          <div className="p-6 space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-4 rounded-full animate-pulse"
                style={{ background: '#E5E7EB', width: `${60 + (i % 3) * 15}%` }}
              />
            ))}
          </div>
        )}

        {!loading && detail && (
          <div className="p-6 space-y-6">
            {/* Info cards */}
            <div className="grid grid-cols-2 gap-3">
              <InfoCard label="Email" value={detail.user.email} />
              <InfoCard label="Отдел" value={detail.user.department ?? '—'} />
              <InfoCard
                label="Баланс"
                value={`${detail.user.total_coins.toLocaleString('ru-RU')} коинов`}
                accent
              />
              <InfoCard
                label="Роль"
                value={detail.user.is_admin ? 'Админ' : 'Пользователь'}
              />
            </div>

            {/* Transactions */}
            <div>
              <h3
                className="text-[13px] font-semibold mb-3"
                style={{ color: 'var(--apex-text-secondary)' }}
              >
                Последние транзакции
              </h3>

              {detail.transactions.length === 0 ? (
                <p
                  className="text-[13px] py-4 text-center"
                  style={{ color: 'var(--apex-text-muted)' }}
                >
                  Нет транзакций
                </p>
              ) : (
                <div
                  className="rounded-xl overflow-hidden"
                  style={{ border: '1px solid var(--apex-border)' }}
                >
                  {detail.transactions.map((tx, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between px-4 py-2.5"
                      style={{
                        borderBottom:
                          i < detail.transactions.length - 1
                            ? '1px solid var(--apex-border)'
                            : 'none',
                      }}
                    >
                      <div>
                        <div
                          className="text-[12px] font-medium"
                          style={{ color: 'var(--apex-text)' }}
                        >
                          {tx.description ?? tx.event_type}
                        </div>
                        <div
                          className="text-[11px]"
                          style={{ color: 'var(--apex-text-muted)' }}
                        >
                          {tx.event_date}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Coins size={12} style={{ color: 'var(--apex-text-muted)' }} />
                        <span
                          className="text-[13px] font-bold"
                          style={{
                            color:
                              tx.coins > 0
                                ? 'var(--apex-success-text)'
                                : tx.coins < 0
                                  ? 'var(--apex-danger)'
                                  : 'var(--apex-text-muted)',
                          }}
                        >
                          {tx.coins > 0 ? '+' : ''}{tx.coins}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function InfoCard({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div
      className="rounded-xl px-4 py-3"
      style={{
        background: accent ? 'var(--apex-success-bg)' : 'var(--apex-bg)',
      }}
    >
      <div
        className="text-[11px] font-medium mb-0.5"
        style={{ color: 'var(--apex-text-muted)' }}
      >
        {label}
      </div>
      <div
        className="text-[13px] font-semibold truncate"
        style={{
          color: accent ? 'var(--apex-primary)' : 'var(--apex-text)',
        }}
      >
        {value}
      </div>
    </div>
  )
}
