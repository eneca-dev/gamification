'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

import { CoinIcon } from '@/components/CoinIcon'

interface PurchaseButtonProps {
  productId: string
  price: number
  canAfford: boolean
  outOfStock: boolean
  deficit: number
  onPurchase: (productId: string, price: number, userComment?: string) => void
  isPurchasing: boolean
  shieldNoPending?: boolean
  isFree?: boolean
  freeLeft?: number | null
  comingSoon?: boolean
  hasDiscount?: boolean
  commentRequired?: boolean
  commentLabel?: string | null
  commentPlaceholder?: string | null
}

export function PurchaseButton({
  productId,
  price,
  canAfford,
  outOfStock,
  deficit,
  onPurchase,
  isPurchasing,
  shieldNoPending = false,
  isFree = false,
  freeLeft = null,
  comingSoon = false,
  hasDiscount = false,
  commentRequired = false,
  commentLabel = null,
  commentPlaceholder = null,
}: PurchaseButtonProps) {
  const [hovered, setHovered] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [comment, setComment] = useState('')

  const disabled = !canAfford || outOfStock || isPurchasing || shieldNoPending || comingSoon
  const showDeficit = !canAfford && !outOfStock && !shieldNoPending && !comingSoon && !isPurchasing

  function getLabel() {
    if (isPurchasing) return 'Покупаем...'
    if (comingSoon) return 'Скоро в продаже'
    if (outOfStock) return 'Нет в наличии'
    if (shieldNoPending) return 'Нет угрозы стрику'
    if (isFree) return 'Спасти бесплатно'
    return (
      <span className="inline-flex items-center gap-1">
        {(price ?? 0).toLocaleString('ru-RU')} <CoinIcon size={13} />
      </span>
    )
  }

  function getBgColor() {
    if (disabled) return 'var(--apex-disabled-bg)'
    if (hasDiscount) return hovered ? 'var(--apex-gold-dark)' : 'var(--apex-gold)'
    return hovered ? 'var(--apex-primary-hover)' : 'var(--apex-primary)'
  }

  function handleClick() {
    if (disabled) return
    if (commentRequired) {
      setComment('')
      setShowDialog(true)
    } else {
      onPurchase(productId, price)
    }
  }

  function handleConfirm() {
    const trimmed = comment.trim()
    if (!trimmed) return
    setShowDialog(false)
    onPurchase(productId, price, trimmed)
  }

  function handleCancel() {
    setShowDialog(false)
    setComment('')
  }

  return (
    <div>
      <button
        className="w-full py-2.5 rounded-xl text-[12px] font-bold transition-all duration-200"
        disabled={disabled}
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          background: getBgColor(),
          color: !disabled ? 'white' : 'var(--text-muted)',
          border: !disabled ? 'none' : '1px solid var(--border)',
          cursor: !disabled ? 'pointer' : 'default',
        }}
      >
        {getLabel()}
      </button>
      <div className="min-h-5 mt-1">
        {showDeficit && (
          <div
            className="flex items-center justify-center gap-0.5 text-[11px] font-medium whitespace-nowrap"
            style={{ color: 'var(--apex-danger)' }}
          >
            Не хватает {deficit.toLocaleString('ru-RU')}&nbsp;<CoinIcon size={10} />
          </div>
        )}
        {isFree && freeLeft !== null && (
          <div
            className="flex items-center justify-center gap-1 text-[11px] font-medium flex-wrap"
            style={{ color: 'var(--apex-primary)' }}
          >
            Доступны {freeLeft} из 2 бесплатных, далее {price.toLocaleString('ru-RU')}&nbsp;<CoinIcon size={10} />
          </div>
        )}
      </div>

      {/* Диалог ввода комментария */}
      {showDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={handleCancel}
        >
          <div className="fixed inset-0 bg-black/40" />
          <div
            className="relative z-10 w-full max-w-sm rounded-2xl p-5 space-y-4 animate-scale-in"
            style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="text-[14px] font-bold" style={{ color: 'var(--apex-text)' }}>
                {commentLabel ?? 'Комментарий к заказу'}
              </p>
              <button
                onClick={handleCancel}
                className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{ color: 'var(--apex-text-muted)' }}
              >
                <X size={16} />
              </button>
            </div>

            <textarea
              autoFocus
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder={commentPlaceholder ?? ''}
              className="w-full px-3 py-2 rounded-xl text-[13px] outline-none resize-none"
              style={{
                background: 'var(--apex-bg)',
                border: '1px solid var(--apex-border)',
                color: 'var(--apex-text)',
              }}
            />

            <div className="flex gap-2">
              <button
                onClick={handleConfirm}
                disabled={!comment.trim() || isPurchasing}
                className="flex-1 py-2 rounded-xl text-[13px] font-bold transition-colors"
                style={{
                  background: comment.trim() ? 'var(--apex-primary)' : 'var(--apex-disabled-bg)',
                  color: comment.trim() ? 'white' : 'var(--text-muted)',
                  cursor: comment.trim() ? 'pointer' : 'default',
                }}
              >
                Подтвердить
              </button>
              <button
                onClick={handleCancel}
                className="px-4 py-2 rounded-xl text-[13px] font-semibold transition-colors"
                style={{
                  background: 'var(--apex-bg)',
                  color: 'var(--apex-text-secondary)',
                  border: '1px solid var(--apex-border)',
                }}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
