'use client'

import { useState } from 'react'
import { ArrowUpRight, ArrowDownLeft } from 'lucide-react'
import { CoinIcon } from '@/components/CoinIcon'

import { GRATITUDE_CATEGORIES } from '../types'
import type { GratitudeNew } from '../types'

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

interface GratitudeListProps {
  items: GratitudeNew[]
  currentUserEmail: string
}

export function GratitudeList({ items, currentUserEmail }: GratitudeListProps) {
  const [tab, setTab] = useState<'all' | 'received' | 'sent'>('all')

  const filtered = items.filter((item) => {
    if (tab === 'received') return item.recipient_email === currentUserEmail
    if (tab === 'sent') return item.sender_email === currentUserEmail
    return true
  })

  const receivedCount = items.filter((i) => i.recipient_email === currentUserEmail).length
  const sentCount = items.filter((i) => i.sender_email === currentUserEmail).length

  return (
    <div>
      {/* Табы */}
      <div className="flex gap-1 mb-5">
        {([
          ['all', `Все (${items.length})`],
          ['received', `Полученные (${receivedCount})`],
          ['sent', `Отправленные (${sentCount})`],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="px-4 py-2 rounded-full text-[13px] font-bold transition-all"
            style={{
              background: tab === key ? 'var(--apex-success-bg)' : 'var(--surface-elevated)',
              color: tab === key ? 'var(--apex-success-text)' : 'var(--text-muted)',
              border: tab === key ? '1px solid var(--teal-100)' : '1px solid var(--border)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Список */}
      {filtered.length === 0 ? (
        <div
          className="rounded-2xl py-12 text-center"
          style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
        >
          <div className="text-3xl mb-3">💜</div>
          <div className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>
            Нет благодарностей
          </div>
          <div className="text-[12px] font-medium mt-1" style={{ color: 'var(--text-muted)' }}>
            {tab === 'sent' ? 'Вы ещё не отправляли благодарностей' : 'Вы ещё не получали благодарностей'}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const isReceived = item.recipient_email === currentUserEmail
            return (
              <div
                key={item.id}
                className="rounded-2xl p-4"
                style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: isReceived ? 'var(--apex-success-bg)' : 'var(--tag-purple-bg)' }}
                  >
                    {isReceived ? (
                      <ArrowDownLeft size={18} style={{ color: 'var(--apex-success-text)' }} />
                    ) : (
                      <ArrowUpRight size={18} style={{ color: 'var(--tag-purple-text)' }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-lg">{getCategoryEmoji(item.category)}</span>
                      <span className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>
                        {isReceived ? `от ${item.sender_name}` : `для ${item.recipient_name}`}
                      </span>
                      <span
                        className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                        style={{ background: 'var(--surface)', color: 'var(--text-muted)' }}
                      >
                        {getCategoryLabel(item.category)}
                      </span>
                    </div>
                    <div
                      className="text-[13px] font-medium mt-1.5 leading-relaxed"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {item.message}
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
                        {timeAgo(item.created_at)}
                      </span>
                      {item.type === 'gift' && item.earned_coins > 0 && (
                        isReceived ? (
                          <span
                            className="text-[11px] font-bold px-2 py-0.5 rounded-md"
                            style={{ background: 'var(--apex-success-bg)', color: 'var(--apex-success-text)' }}
                          >
                            <span className="inline-flex items-center gap-0.5">+{item.earned_coins} <CoinIcon size={11} /></span>
                          </span>
                        ) : item.gift_source === 'quota' ? (
                          <span
                            className="text-[11px] font-medium px-2 py-0.5 rounded-md"
                            style={{ background: 'var(--tag-purple-bg)', color: 'var(--tag-purple-text)' }}
                          >
                            квота
                          </span>
                        ) : (
                          <span
                            className="text-[11px] font-bold px-2 py-0.5 rounded-md"
                            style={{ background: 'var(--apex-warning-bg)', color: 'var(--tag-orange-text)' }}
                          >
                            <span className="inline-flex items-center gap-0.5">-{item.earned_coins} <CoinIcon size={11} /></span>
                          </span>
                        )
                      )}
                      {item.type === 'thanks' && (
                        <span
                          className="text-[11px] font-medium px-2 py-0.5 rounded-md"
                          style={{ background: 'var(--tag-purple-bg)', color: 'var(--tag-purple-text)' }}
                        >
                          спасибо
                        </span>
                      )}
                      {isReceived && item.sender_department && (
                        <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                          {item.sender_department}
                        </span>
                      )}
                      {!isReceived && item.recipient_department && (
                        <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                          {item.recipient_department}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
