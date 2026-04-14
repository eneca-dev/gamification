'use client'

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
}: PurchaseButtonProps) {
  const disabled = !canAfford || outOfStock || isPurchasing || shieldNoPending
  const showDeficit = !canAfford && !outOfStock && !shieldNoPending

  function getLabel() {
    if (isPurchasing) return 'Покупаем...'
    if (outOfStock) return 'Нет в наличии'
    if (shieldNoPending) return 'Нет угрозы стрику'
    return (
      <span className="inline-flex items-center gap-1">
        {price.toLocaleString('ru-RU')} <CoinIcon size={13} />
      </span>
    )
  }

  return (
    <div>
      <button
        className="w-full py-2.5 rounded-xl text-[12px] font-bold transition-all duration-200"
        disabled={disabled}
        onClick={() => onPurchase(productId, price)}
        style={{
          background: !disabled ? 'var(--apex-primary)' : 'var(--apex-disabled-bg)',
          color: !disabled ? 'white' : 'var(--text-muted)',
          border: !disabled ? 'none' : '1px solid var(--border)',
          cursor: !disabled ? 'pointer' : 'default',
        }}
      >
        {getLabel()}
      </button>
      {/* Фиксированная высота для зоны дефицита — чтобы все кнопки на одном уровне */}
      <div className="h-5 mt-1">
        {showDeficit && (
          <div
            className="flex items-center justify-center gap-0.5 text-[11px] font-medium whitespace-nowrap"
            style={{ color: 'var(--apex-danger)' }}
          >
            Не хватает {deficit.toLocaleString('ru-RU')}&nbsp;<CoinIcon size={10} />
          </div>
        )}
      </div>
    </div>
  )
}
