'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, ArrowUpRight, ArrowDownLeft } from 'lucide-react'

import { GRATITUDE_CATEGORIES } from '../types'
import type { GratitudeNew } from '../types'

interface GratitudeHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  items: GratitudeNew[]
  currentUserEmail: string
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

export function GratitudeHistoryModal({ isOpen, onClose, items, currentUserEmail }: GratitudeHistoryModalProps) {
  const [tab, setTab] = useState<'all' | 'received' | 'sent'>('all')

  if (!isOpen) return null

  const filtered = items.filter((item) => {
    if (tab === 'received') return item.recipient_email === currentUserEmail
    if (tab === 'sent') return item.sender_email === currentUserEmail
    return true
  })

  const modalContent = (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.15)', backdropFilter: 'blur(4px)', zIndex: 9999 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
    >
      <div
        className="rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
        style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,0.12)' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gratitude-history-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <h2 id="gratitude-history-title" className="text-[15px] font-extrabold" style={{ color: 'var(--text-primary)' }}>
            Все благодарности
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:bg-[var(--surface)]">
            <X size={16} style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>

        {/* Табы */}
        <div className="flex gap-1 px-5 pb-3 shrink-0">
          {([['all', 'Все'], ['received', 'Полученные'], ['sent', 'Отправленные']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="px-3 py-1.5 rounded-full text-[12px] font-bold transition-all"
              style={{
                background: tab === key ? 'var(--apex-success-bg)' : 'transparent',
                color: tab === key ? 'var(--apex-success-text)' : 'var(--text-muted)',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Список */}
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-[13px] font-medium" style={{ color: 'var(--text-muted)' }}>
              Нет благодарностей
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((item) => {
                const isReceived = item.recipient_email === currentUserEmail
                return (
                  <div
                    key={item.id}
                    className="rounded-xl p-3"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                        style={{
                          background: isReceived ? 'var(--apex-success-bg)' : 'var(--tag-purple-bg)',
                        }}
                      >
                        {isReceived ? (
                          <ArrowDownLeft size={14} style={{ color: 'var(--apex-success-text)' }} />
                        ) : (
                          <ArrowUpRight size={14} style={{ color: 'var(--tag-purple-text)' }} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-base">{getCategoryEmoji(item.category)}</span>
                          <span className="text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>
                            {isReceived ? `от ${item.sender_name}` : `для ${item.recipient_name}`}
                          </span>
                          <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                            {getCategoryLabel(item.category)}
                          </span>
                        </div>
                        <div
                          className="text-[12px] font-medium mt-0.5 line-clamp-2"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {item.message}
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
                          {item.type === 'thanks' && (
                            <span
                              className="text-[10px] font-medium px-1.5 py-0.5 rounded-md"
                              style={{ background: 'var(--tag-purple-bg)', color: 'var(--tag-purple-text)' }}
                            >
                              спасибо
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
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(modalContent, document.body)
}
