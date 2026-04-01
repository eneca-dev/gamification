'use client'

import { useState, useEffect, useTransition, useRef } from 'react'
import { Shield, AlertTriangle } from 'lucide-react'

import { buyStreakShield } from '@/modules/streak-shield/index.client'

import type { PendingReset } from '../types'

interface StreakShieldAlertProps {
  pending: PendingReset
  userBalance: number
}

function formatTimeLeft(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now()
  if (diff <= 0) return 'Время вышло'

  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  if (hours > 0) return `${hours}ч ${minutes}м`
  return `${minutes}м`
}

export function StreakShieldAlert({ pending, userBalance }: StreakShieldAlertProps) {
  const [timeLeft, setTimeLeft] = useState(() => formatTimeLeft(pending.expiresAt))
  const [isExpired, setIsExpired] = useState(() => new Date(pending.expiresAt).getTime() <= Date.now())
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const isSubmitting = useRef(false)

  const canAfford = userBalance >= pending.price
  const label = pending.type === 'ws' ? 'Worksection' : 'Автоматизация'

  useEffect(() => {
    const interval = setInterval(() => {
      const diff = new Date(pending.expiresAt).getTime() - Date.now()
      if (diff <= 0) {
        setIsExpired(true)
        setTimeLeft('Время вышло')
        clearInterval(interval)
      } else {
        setTimeLeft(formatTimeLeft(pending.expiresAt))
      }
    }, 30_000)

    return () => clearInterval(interval)
  }, [pending.expiresAt])

  if (success) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-medium"
        style={{
          background: 'var(--apex-success-bg)',
          border: '1px solid rgba(var(--apex-primary-rgb), 0.2)',
          color: 'var(--apex-primary)',
        }}
      >
        <Shield size={14} />
        <span>Стрик {label} спасён!</span>
      </div>
    )
  }

  if (isExpired) return null

  function handleBuy() {
    if (isSubmitting.current) return
    isSubmitting.current = true
    setError(null)
    startTransition(async () => {
      const result = await buyStreakShield(pending.type)
      isSubmitting.current = false
      if (result.success) {
        setSuccess(true)
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
      style={{
        background: 'rgba(var(--apex-danger-rgb, 220,53,69), 0.08)',
        border: '1px solid rgba(var(--apex-danger-rgb, 220,53,69), 0.2)',
      }}
    >
      <AlertTriangle size={16} style={{ color: 'var(--apex-danger)', flexShrink: 0 }} />

      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-semibold" style={{ color: 'var(--apex-text)' }}>
          Стрик {label} под угрозой!
        </div>
        <div className="text-[11px]" style={{ color: 'var(--apex-text-muted)' }}>
          Красный день {pending.pendingResetDate} · Осталось {timeLeft}
        </div>
        {error && (
          <div className="text-[11px] mt-0.5" style={{ color: 'var(--apex-danger)' }}>{error}</div>
        )}
      </div>

      <button
        onClick={handleBuy}
        disabled={isPending || !canAfford}
        className="px-3 py-1.5 rounded-full text-[11px] font-semibold transition-opacity shrink-0 disabled:opacity-50"
        style={{
          background: canAfford ? 'var(--apex-primary)' : 'var(--apex-border)',
          color: canAfford ? 'white' : 'var(--apex-text-muted)',
        }}
      >
        {isPending ? 'Покупка...' : `Спасти за ${pending.price} ПК`}
      </button>
    </div>
  )
}
