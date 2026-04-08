'use client'

import { useState, useTransition, useEffect, useRef, useMemo } from 'react'
import { Ticket, Clock } from 'lucide-react'

import { CoinStatic } from '@/components/CoinBalance'
import { purchaseProduct } from '@/modules/shop/index.client'

import type { LotteryWithStats, UserTicketInfo } from '../types'

// Розыгрыш — 1-е число следующего месяца в 12:00 по Минску (UTC+3)
const DRAW_HOUR_UTC = 9 // 12:00 Minsk = 09:00 UTC

interface LotteryBannerProps {
  lottery: LotteryWithStats
  ticketInfo: UserTicketInfo | null
  balance: number
  serverTime: number
}

export function LotteryBanner({ lottery, ticketInfo: initialTicketInfo, balance, serverTime }: LotteryBannerProps) {
  const [ticketInfo, setTicketInfo] = useState(initialTicketInfo)
  const [currentBalance, setCurrentBalance] = useState(balance)
  const [isPending, startTransition] = useTransition()
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [countdown, setCountdown] = useState<CountdownState | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const drawDate = useMemo(() => getDrawDate(lottery.month), [lottery.month])

  // Разница между серверным и клиентским временем (вычисляется один раз)
  // Если у юзера часы спешат на 2 часа, offset = -7200000
  // Используем offset чтобы всегда считать по серверному (= реальному) времени
  const timeOffsetRef = useRef(serverTime - Date.now())

  useEffect(() => {
    function tick() {
      const now = Date.now() + timeOffsetRef.current
      const diff = drawDate.getTime() - now
      if (diff <= 0) {
        setCountdown({ hours: 0, minutes: 0, seconds: 0, isLast24h: true })
        if (intervalRef.current) clearInterval(intervalRef.current)
        return
      }

      const hoursLeft = diff / (1000 * 60 * 60)
      const isLast24h = hoursLeft <= 24

      if (isLast24h) {
        const hours = Math.floor(diff / (1000 * 60 * 60))
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((diff % (1000 * 60)) / 1000)
        setCountdown({ hours, minutes, seconds, isLast24h: true })
      } else {
        setCountdown({ hours: 0, minutes: 0, seconds: 0, isLast24h: false })
      }
    }

    tick()
    // Обновляем каждую секунду только в последние 24ч, иначе — не нужно
    intervalRef.current = setInterval(tick, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [drawDate])

  // Останавливаем интервал когда не в режиме last24h
  useEffect(() => {
    if (countdown && !countdown.isLast24h && intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [countdown?.isLast24h])

  function handleBuyTicket() {
    setNotification(null)

    const prevTickets = ticketInfo
    const prevBalance = currentBalance

    // Optimistic: обновляем билеты и баланс мгновенно
    setCurrentBalance(currentBalance - lottery.ticket_price)
    if (ticketInfo) {
      setTicketInfo({
        ticket_count: ticketInfo.ticket_count + 1,
        total_tickets: ticketInfo.total_tickets + 1,
        chance_percent: Math.round(((ticketInfo.ticket_count + 1) / (ticketInfo.total_tickets + 1)) * 10000) / 100,
      })
    } else {
      const total = (lottery.total_tickets || 0) + 1
      setTicketInfo({
        ticket_count: 1,
        total_tickets: total,
        chance_percent: Math.round((1 / total) * 10000) / 100,
      })
    }

    startTransition(async () => {
      const result = await purchaseProduct(lottery.product_id)
      if (!result.success) {
        setTicketInfo(prevTickets)
        setCurrentBalance(prevBalance)
        setNotification({ type: 'error', message: result.error })
      } else {
        setNotification({ type: 'success', message: 'Билет куплен!' })
      }
      setTimeout(() => setNotification(null), 3000)
    })
  }

  const canAfford = currentBalance >= lottery.ticket_price
  const hasTickets = ticketInfo && ticketInfo.ticket_count > 0

  return (
    <div
      className="rounded-2xl overflow-hidden animate-fade-in-up"
      style={{ border: '1px solid var(--apex-border)' }}
    >
      {/* Заголовок */}
      <div
        className="px-5 py-4 flex items-center justify-between"
        style={{ background: 'linear-gradient(135deg, var(--apex-primary), var(--apex-primary-deep))' }}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎰</span>
          <div>
            <h2 className="text-white font-bold text-base">Розыгрыш месяца</h2>
            <DrawCountdown countdown={countdown} drawDate={drawDate} />
          </div>
        </div>
        <div
          className="px-3 py-1.5 rounded-full text-xs font-semibold"
          style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}
        >
          <Ticket size={12} className="inline mr-1 -translate-y-[0.5px]" />
          {(ticketInfo?.total_tickets ?? lottery.total_tickets)} билетов
        </div>
      </div>

      {/* Тело */}
      <div className="p-5" style={{ background: 'var(--surface-elevated)' }}>
        {notification && (
          <div
            className="mb-4 rounded-lg px-4 py-2.5 text-[13px] font-semibold"
            style={{
              background: notification.type === 'success' ? 'var(--apex-success-bg)' : 'var(--apex-error-bg)',
              color: notification.type === 'success' ? 'var(--apex-success-text)' : 'var(--apex-error-text)',
            }}
          >
            {notification.message}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Картинка приза */}
          {lottery.image_url && (
            <div className="flex-shrink-0">
              <img
                src={lottery.image_url}
                alt={lottery.name}
                className="w-24 h-24 sm:w-28 sm:h-28 object-contain rounded-xl"
                style={{ background: 'var(--surface)', border: '1px solid var(--apex-border)' }}
              />
            </div>
          )}

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {!lottery.image_url && <span className="text-xl">🎁</span>}
              <h3 className="text-lg font-bold" style={{ color: 'var(--apex-text-primary)' }}>
                {lottery.name}
              </h3>
            </div>
            {lottery.description && (
              <p className="text-sm mb-3" style={{ color: 'var(--apex-text-secondary)' }}>
                {lottery.description}
              </p>
            )}

            {hasTickets && (
              <div className="flex gap-4 mb-1">
                <div className="text-sm" style={{ color: 'var(--apex-text-secondary)' }}>
                  Ваши билеты:{' '}
                  <span className="font-semibold" style={{ color: 'var(--apex-primary)' }}>
                    {ticketInfo.ticket_count}
                  </span>
                </div>
                <div className="text-sm" style={{ color: 'var(--apex-text-secondary)' }}>
                  Шанс:{' '}
                  <span className="font-semibold" style={{ color: 'var(--orange-500, #FF9800)' }}>
                    {ticketInfo.chance_percent}%
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="flex-shrink-0">
            <button
              onClick={handleBuyTicket}
              disabled={!canAfford || isPending}
              className="w-full sm:w-auto px-6 py-3 rounded-full text-sm font-semibold text-white transition-all duration-200 disabled:opacity-50"
              style={{ background: canAfford ? 'var(--apex-primary)' : 'var(--apex-text-secondary)' }}
            >
              {isPending ? (
                'Покупаем...'
              ) : !canAfford ? (
                <>Ещё {lottery.ticket_price - currentBalance} баллов</>
              ) : (
                <span className="flex items-center gap-2">
                  <Ticket size={16} />
                  Купить билет
                  <CoinStatic amount={lottery.ticket_price} size="sm" />
                </span>
              )}
            </button>
            {hasTickets && (
              <p className="text-center text-xs mt-2" style={{ color: 'var(--apex-text-secondary)' }}>
                На покупку билетов нет лимита — больше билетов = больше шанс
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// --- Вспомогательные ---

interface CountdownState {
  hours: number
  minutes: number
  seconds: number
  isLast24h: boolean
}

/**
 * Вычисляет дату розыгрыша: 1-е число следующего месяца в 12:00 Минск
 */
function getDrawDate(lotteryMonth: string): Date {
  const month = new Date(lotteryMonth)
  const drawDate = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1, DRAW_HOUR_UTC, 0, 0))
  return drawDate
}

function DrawCountdown({ countdown, drawDate }: { countdown: CountdownState | null; drawDate: Date }) {
  if (!countdown) {
    return <p className="text-white/70 text-xs">Загрузка...</p>
  }

  if (countdown.isLast24h) {
    const pad = (n: number) => String(n).padStart(2, '0')
    return (
      <div className="flex items-center gap-1.5">
        <Clock size={12} className="text-orange-400" />
        <p className="text-orange-300 text-xs font-semibold tracking-wide font-mono">
          До розыгрыша: {pad(countdown.hours)}:{pad(countdown.minutes)}:{pad(countdown.seconds)}
        </p>
      </div>
    )
  }

  const formatted = drawDate.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Minsk',
  })

  return (
    <p className="text-white/70 text-xs">
      Розыгрыш: {formatted}
    </p>
  )
}
