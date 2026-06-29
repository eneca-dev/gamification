'use client'

import { useState } from 'react'

import { CoinIcon } from '@/components/CoinIcon'

interface PurchaseButtonProps {
  productId: string
  price: number
  canAfford: boolean
  outOfStock: boolean
  deficit: number
  onPurchase: (productId: string, price: number) => void
  isPurchasing: boolean
  shieldNoPending?: boolean
  isFree?: boolean
  freeLeft?: number | null
  comingSoon?: boolean
  hasDiscount?: boolean
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
}: PurchaseButtonProps) {
  const [hovered, setHovered] = useState(false)
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

  return (
    <div>
      <button
        className="w-full py-2.5 rounded-xl text-[12px] font-bold transition-all duration-200"
        disabled={disabled}
        onClick={() => onPurchase(productId, price)}
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
    </div>
  )
}
