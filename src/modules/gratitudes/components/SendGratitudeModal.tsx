'use client'

import { useState, useTransition, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { X, Heart, Gift, Search, Send, Sparkles, Coins, CheckCircle } from 'lucide-react'

import { sendGratitude } from '../actions'
import { GRATITUDE_CATEGORIES } from '../types'
import type { GratitudeCategory, SenderQuota, GratitudeRecipient } from '../types'

function pluralizeDays(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 14) return 'дней'
  if (mod10 === 1) return 'день'
  if (mod10 >= 2 && mod10 <= 4) return 'дня'
  return 'дней'
}

interface SendGratitudeModalProps {
  isOpen: boolean
  onClose: () => void
  senderId: string
  quota: SenderQuota
  recipients: GratitudeRecipient[]
  balance: number
}

function quotaDaysLeft(quota: SenderQuota): number {
  if (!quota.period_end) return 0
  return Math.max(0, Math.ceil((new Date(quota.period_end).getTime() - Date.now()) / 86400000) + 1)
}

function nextQuotaDays(quota: SenderQuota): number {
  if (!quota.next_quota_date) return 0
  return Math.max(0, Math.ceil((new Date(quota.next_quota_date).getTime() - Date.now()) / 86400000))
}

export function SendGratitudeModal({
  isOpen, onClose, senderId, quota, recipients, balance,
}: SendGratitudeModalProps) {
  const [step, setStep] = useState<'form' | 'success'>('form')
  const [category, setCategory] = useState<GratitudeCategory | null>(null)
  const [recipientId, setRecipientId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [showBalanceInput, setShowBalanceInput] = useState(false)
  const [coinsAmount, setCoinsAmount] = useState(10)
  const [searchQuery, setSearchQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [lastSentType, setLastSentType] = useState<'thanks' | 'gift'>('thanks')

  const filteredRecipients = useMemo(() => {
    if (!searchQuery.trim()) return recipients.slice(0, 8)
    const q = searchQuery.toLowerCase()
    return recipients
      .filter((r) => r.name.toLowerCase().includes(q) || (r.department ?? '').toLowerCase().includes(q))
      .slice(0, 8)
  }, [searchQuery, recipients])

  const selectedRecipient = recipients.find((r) => r.id === recipientId)

  function reset() {
    setStep('form')
    setCategory(null)
    setRecipientId(null)
    setMessage('')
    setShowBalanceInput(false)
    setCoinsAmount(10)
    setSearchQuery('')
    setShowDropdown(false)
    setError(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  function validate(): boolean {
    if (!recipientId || !category || !message.trim()) {
      setError('Заполните все поля')
      return false
    }
    setError(null)
    return true
  }

  // Отправить простую благодарность
  function handleSendThanks() {
    if (!validate()) return
    setLastSentType('thanks')
    startTransition(async () => {
      const result = await sendGratitude(senderId, {
        recipient_id: recipientId!,
        message: message.trim(),
        category: category!,
        type: 'thanks',
        gift_source: null,
        coins_amount: 0,
      })
      if (result.success) setStep('success')
      else setError(result.error)
    })
  }

  // Отправить подарок по квоте
  function handleSendQuotaGift() {
    if (!validate()) return
    setLastSentType('gift')
    startTransition(async () => {
      const result = await sendGratitude(senderId, {
        recipient_id: recipientId!,
        message: message.trim(),
        category: category!,
        type: 'gift',
        gift_source: 'quota',
        coins_amount: 0,
      })
      if (result.success) setStep('success')
      else setError(result.error)
    })
  }

  // Отправить подарок за свой счёт
  function handleSendBalanceGift() {
    if (!validate()) return
    if (coinsAmount > balance) {
      setError('Недостаточно баллов')
      return
    }
    if (coinsAmount < 1) {
      setError('Минимум 1 ПК')
      return
    }
    setLastSentType('gift')
    startTransition(async () => {
      const result = await sendGratitude(senderId, {
        recipient_id: recipientId!,
        message: message.trim(),
        category: category!,
        type: 'gift',
        gift_source: 'balance',
        coins_amount: coinsAmount,
      })
      if (result.success) setStep('success')
      else setError(result.error)
    })
  }

  if (!isOpen) return null

  const daysLeft = quotaDaysLeft(quota)
  const nextDays = nextQuotaDays(quota)

  const modalContent = (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.15)', backdropFilter: 'blur(4px)', zIndex: 9999 }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
      onKeyDown={(e) => { if (e.key === 'Escape') handleClose() }}
    >
      <div
        className="rounded-2xl w-full max-w-md overflow-hidden"
        style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,0.12)' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="send-gratitude-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 id="send-gratitude-title" className="text-[15px] font-extrabold" style={{ color: 'var(--text-primary)' }}>
            {step === 'form' ? 'Поблагодарить коллегу' : (lastSentType === 'thanks' ? 'Спасибо отправлено!' : 'Подарок отправлен!')}
          </h2>
          <button onClick={handleClose} className="p-1.5 rounded-lg transition-colors hover:bg-[var(--surface)]">
            <X size={16} style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>

        {/* === ФОРМА === */}
        {step === 'form' && (
          <div className="px-5 pb-5 space-y-4">
            {/* Получатель */}
            <div className="relative">
              <label className="text-[11px] font-bold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-muted)' }}>
                Кому
              </label>
              {selectedRecipient ? (
                <div
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                  style={{ background: 'var(--apex-success-bg)', border: '1px solid var(--teal-100)' }}
                >
                  <div>
                    <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {selectedRecipient.name}
                    </span>
                    {selectedRecipient.department && (
                      <span className="text-[11px] ml-2" style={{ color: 'var(--text-muted)' }}>
                        {selectedRecipient.department}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => { setRecipientId(null); setSearchQuery('') }}
                    className="p-0.5 rounded-md hover:bg-[rgba(0,0,0,0.05)]"
                  >
                    <X size={14} style={{ color: 'var(--text-muted)' }} />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setShowDropdown(true) }}
                    onFocus={() => setShowDropdown(true)}
                    placeholder="Поиск по имени или отделу..."
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl text-[13px] font-medium outline-none"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  />
                  {showDropdown && filteredRecipients.length > 0 && (
                    <div
                      className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden max-h-48 overflow-y-auto"
                      style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', zIndex: 60 }}
                    >
                      {filteredRecipients.map((r) => (
                        <button
                          key={r.id}
                          onClick={() => { setRecipientId(r.id); setSearchQuery(''); setShowDropdown(false) }}
                          className="w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface)]"
                        >
                          <span className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>{r.name}</span>
                          {r.department && (
                            <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>{r.department}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Категория */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-muted)' }}>
                За что
              </label>
              <div className="grid grid-cols-2 gap-2">
                {GRATITUDE_CATEGORIES.map((cat) => (
                  <button
                    key={cat.slug}
                    onClick={() => setCategory(cat.slug)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-[12px] font-semibold transition-all duration-150"
                    style={{
                      background: category === cat.slug ? 'var(--apex-success-bg)' : 'var(--surface)',
                      border: category === cat.slug ? '1.5px solid var(--teal-100)' : '1.5px solid var(--border)',
                      color: category === cat.slug ? 'var(--apex-success-text)' : 'var(--text-secondary)',
                    }}
                  >
                    <span className="text-base">{cat.emoji}</span>
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Сообщение */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-muted)' }}>
                Сообщение
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Напишите, за что вы благодарны..."
                rows={3}
                maxLength={500}
                className="w-full px-3 py-2.5 rounded-xl text-[13px] font-medium outline-none resize-none"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              />
              <div className="text-right text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {message.length}/500
              </div>
            </div>

            {/* Ввод суммы при оплате из баланса */}
            {showBalanceInput && (
              <div
                className="px-3 py-3 rounded-xl"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Coins size={14} style={{ color: 'var(--orange-500)' }} />
                    <span className="text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>Сумма подарка</span>
                  </div>
                  <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
                    Баланс: {balance.toLocaleString('ru-RU')} ПК
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {[10, 20, 50, 100].map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setCoinsAmount(amount)}
                      className="flex-1 py-2 rounded-lg text-[12px] font-bold transition-all"
                      style={{
                        background: coinsAmount === amount ? 'var(--apex-success-bg)' : 'var(--surface-elevated)',
                        border: coinsAmount === amount ? '1.5px solid var(--teal-100)' : '1.5px solid var(--border)',
                        color: coinsAmount === amount ? 'var(--apex-success-text)' : 'var(--text-secondary)',
                      }}
                    >
                      {amount}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleSendBalanceGift}
                  disabled={isPending}
                  className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 rounded-full text-[12px] font-bold transition-all disabled:opacity-40"
                  style={{ background: 'var(--apex-primary)', color: 'white' }}
                >
                  {isPending ? 'Отправляется...' : (
                    <>
                      <Send size={13} />
                      Отправить подарок за {coinsAmount} ПК
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Ошибка */}
            {error && (
              <div
                className="px-3 py-2 rounded-xl text-[12px] font-semibold"
                style={{ background: 'var(--apex-error-bg)', color: 'var(--apex-danger)' }}
              >
                {error}
              </div>
            )}

            {/* Две основные кнопки */}
            {!showBalanceInput && (
              <div className="space-y-2">
                {/* Кнопка "Сказать спасибо" */}
                <button
                  onClick={handleSendThanks}
                  disabled={isPending}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-full text-[13px] font-bold transition-all disabled:opacity-40"
                  style={{ background: 'var(--surface)', color: 'var(--text-primary)', border: '1.5px solid var(--border)' }}
                >
                  {isPending ? 'Отправляется...' : (
                    <>
                      <Heart size={14} style={{ color: 'var(--tag-purple-text)' }} />
                      Сказать спасибо
                    </>
                  )}
                </button>

                {/* Кнопка "Подарок" */}
                {!quota.used ? (
                  // Квота доступна
                  <div>
                    <button
                      onClick={handleSendQuotaGift}
                      disabled={isPending}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-full text-[13px] font-bold transition-all disabled:opacity-40"
                      style={{ background: 'var(--apex-primary)', color: 'white' }}
                    >
                      {isPending ? 'Отправляется...' : (
                        <>
                          <Gift size={14} />
                          Подарить +{quota.coins_per_gratitude} ПК (бесплатно)
                        </>
                      )}
                    </button>
                    <div className="text-center text-[11px] font-medium mt-1.5" style={{ color: 'var(--text-muted)' }}>
                      Бесплатная квота на 2 недели — осталось {daysLeft} {pluralizeDays(daysLeft)}
                    </div>
                  </div>
                ) : (
                  // Квота использована
                  <div>
                    <button
                      onClick={() => setShowBalanceInput(true)}
                      disabled={isPending}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-full text-[13px] font-bold transition-all disabled:opacity-40"
                      style={{ background: 'var(--surface)', color: 'var(--apex-primary)', border: '1.5px solid var(--apex-primary)' }}
                    >
                      <Gift size={14} />
                      Подарить за свой счёт
                    </button>
                    <div className="text-center text-[11px] font-medium mt-1.5" style={{ color: 'var(--text-muted)' }}>
                      Квота использована. Новая через {nextDays} {pluralizeDays(nextDays)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* === УСПЕХ === */}
        {step === 'success' && (
          <div className="px-5 pb-6 text-center">
            <div className="py-6">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: lastSentType === 'thanks' ? 'var(--tag-purple-bg)' : 'var(--apex-success-bg)' }}
              >
                {lastSentType === 'thanks' ? (
                  <Sparkles size={28} style={{ color: 'var(--tag-purple-text)' }} />
                ) : (
                  <CheckCircle size={28} style={{ color: 'var(--apex-success-text)' }} />
                )}
              </div>
              <div className="text-[15px] font-extrabold mb-1" style={{ color: 'var(--text-primary)' }}>
                {lastSentType === 'thanks' ? 'Спасибо отправлено!' : 'Подарок отправлен!'}
              </div>
              <div className="text-[12px] font-medium" style={{ color: 'var(--text-muted)' }}>
                {selectedRecipient?.name}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={reset}
                className="flex-1 py-2.5 rounded-full text-[12px] font-bold"
                style={{ background: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
              >
                Ещё одну
              </button>
              <button
                onClick={handleClose}
                className="flex-1 py-2.5 rounded-full text-[12px] font-bold"
                style={{ background: 'var(--apex-primary)', color: 'white' }}
              >
                Готово
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(modalContent, document.body)
}
