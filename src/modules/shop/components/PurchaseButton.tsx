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

  function getLabel() {
    if (isPurchasing) return 'Покупаем...'
    if (outOfStock) return 'Нет в наличии'
    if (shieldNoPending) return 'Нет угрозы стрику'
    if (!canAfford) return <span className="inline-flex items-center gap-1">Ещё {deficit.toLocaleString('ru-RU')} <CoinIcon size={12} /></span>
    return <span className="inline-flex items-center gap-1">Получить за {price.toLocaleString('ru-RU')} <CoinIcon size={12} /></span>
  }

  return (
    <button
      className="w-full py-2.5 rounded-xl text-[12px] font-bold transition-all duration-200"
      disabled={disabled}
      onClick={() => onPurchase(productId, price)}
      style={{
        background: !disabled ? 'var(--apex-primary)' : 'var(--surface)',
        color: !disabled ? 'white' : 'var(--text-muted)',
        border: !disabled ? 'none' : '1px solid var(--border)',
        cursor: !disabled ? 'pointer' : 'default',
        opacity: !disabled ? 1 : 0.7,
      }}
    >
      {getLabel()}
    </button>
  )
}
