'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Heart, ArrowDownLeft, ArrowUpRight } from 'lucide-react'

import { SendGratitudeModal } from './SendGratitudeModal'
import { GRATITUDE_CATEGORIES } from '../types'
import type { GratitudeNew, SenderQuota, GratitudeRecipient } from '../types'

interface GratitudeWidgetProps {
  senderId: string
  currentUserEmail: string
  quota: SenderQuota
  recipients: GratitudeRecipient[]
  balance: number
  myGratitudes: GratitudeNew[]
}

function getCategoryEmoji(cat: string | null): string {
  return GRATITUDE_CATEGORIES.find((c) => c.slug === cat)?.emoji ?? '💬'
}

function getCategoryLabel(cat: string | null): string {
  return GRATITUDE_CATEGORIES.find((c) => c.slug === cat)?.label ?? 'Другое'
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins} мин. назад`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} ч. назад`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'вчера'
  if (days < 7) return `${days} дн. назад`
  return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

function GratitudeCard({
  item,
  isReceived,
}: {
  item: GratitudeNew
  isReceived: boolean
}) {
  return (
    <div
      className="flex items-start gap-3 p-3 rounded-xl"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: isReceived ? 'var(--apex-success-bg)' : 'var(--tag-purple-bg)' }}
      >
        {isReceived ? (
          <ArrowDownLeft size={14} style={{ color: 'var(--apex-success-text)' }} />
        ) : (
          <ArrowUpRight size={14} style={{ color: 'var(--tag-purple-text)' }} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{getCategoryEmoji(item.category)}</span>
          <span className="text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>
            {isReceived ? item.sender_name : item.recipient_name}
          </span>
          <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
            {getCategoryLabel(item.category)}
          </span>
        </div>
        <div
          className="text-[12px] font-medium mt-0.5 truncate"
          style={{ color: 'var(--text-secondary)' }}
        >
          &ldquo;{item.message}&rdquo;
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
            {timeAgo(item.created_at)}
          </span>
          {item.type === 'gift' && item.earned_coins > 0 && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
              style={{ background: 'var(--apex-success-bg)', color: 'var(--apex-success-text)' }}
            >
              {isReceived ? '+' : '-'}{item.earned_coins} ПК
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export function GratitudeWidget({
  senderId, currentUserEmail, quota, recipients, balance, myGratitudes,
}: GratitudeWidgetProps) {
  const [showSendModal, setShowSendModal] = useState(false)

  const received = myGratitudes.filter((g) => g.recipient_email === currentUserEmail)
  const hasAny = received.length > 0

  return (
    <>
      <div
        className="rounded-2xl overflow-hidden h-full flex flex-col"
        style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
      >
        {/* Шапка */}
        <div className="flex items-center justify-between px-5 py-3.5 shrink-0">
          <div className="flex items-center gap-2">
            <Heart size={16} style={{ color: 'var(--tag-purple-text)' }} fill="var(--tag-purple-text)" />
            <span className="text-[14px] font-extrabold" style={{ color: 'var(--text-primary)' }}>
              Благодарности
            </span>
          </div>
          <button
            onClick={() => setShowSendModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-bold transition-all hover:scale-105 active:scale-95"
            style={{
              background: 'linear-gradient(135deg, var(--apex-primary), var(--apex-primary-hover))',
              color: 'white',
              boxShadow: '0 2px 8px rgba(27,107,88,0.25)',
            }}
          >
            <Heart size={13} fill="white" />
            Поблагодарить
            {!quota.used && (
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: '#FF9800', boxShadow: '0 0 4px rgba(255,152,0,0.5)' }}
              />
            )}
          </button>
        </div>

        {/* Контент */}
        <div className="px-5 pb-4 flex-1 overflow-hidden">
          {hasAny ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-1">
                <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Последние полученные
                </div>
                <Link
                  href="/gratitudes"
                  className="text-[12px] font-semibold"
                  style={{ color: 'var(--apex-primary)' }}
                >
                  Все благодарности →
                </Link>
              </div>
              {received.slice(0, 3).map((g) => (
                <GratitudeCard key={g.id} item={g} isReceived />
              ))}
            </div>
          ) : (
            // Пустое состояние
            <div
              className="rounded-xl py-6 text-center"
              style={{ background: 'var(--surface)' }}
            >
              <div className="text-2xl mb-2">💜</div>
              <div className="text-[13px] font-bold mb-0.5" style={{ color: 'var(--text-primary)' }}>
                Отправьте благодарность коллеге!
              </div>
              <div className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
                Признайте вклад, поддержите команду
              </div>
            </div>
          )}
        </div>

      </div>

      <SendGratitudeModal
        isOpen={showSendModal}
        onClose={() => setShowSendModal(false)}
        senderId={senderId}
        quota={quota}
        recipients={recipients}
        balance={balance}
      />

    </>
  )
}
