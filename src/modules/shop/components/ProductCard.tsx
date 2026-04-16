'use client'

import { PurchaseButton } from './PurchaseButton'
import type { ShopProductWithCategory } from '../types'
import type { PendingReset } from '@/modules/streak-shield/index.client'

interface ProductCardProps {
  product: ShopProductWithCategory
  balance: number
  index: number
  onPurchase: (productId: string, price: number) => void
  isPurchasing: boolean
  categoryDescription?: string | null
  pendingResets?: PendingReset[]
}

export function ProductCard({ product, balance, index, onPurchase, isPurchasing, categoryDescription, pendingResets = [] }: ProductCardProps) {
  const canAfford = balance >= product.price
  const outOfStock = product.category.is_physical && product.stock !== null && product.stock === 0
  const deficit = product.price - balance

  // Для щитов: кнопка активна только при наличии соответствующего pending
  const shieldEffect = product.effect
  const isShield = shieldEffect === 'streak_shield_ws' || shieldEffect === 'streak_shield_revit'
  const shieldType = shieldEffect === 'streak_shield_ws' ? 'ws' : 'revit'
  const hasActivePending = isShield && pendingResets.some((p) => p.type === shieldType)

  return (
    <div
      className={`rounded-2xl overflow-hidden card-hover flex flex-col stagger-${Math.min(index + 1, 6)}`}
      {...(index === 0 ? { 'data-onboarding': 'product-card-first' } : {})}
      style={{
        background: 'var(--surface-elevated)',
        border: '1px solid var(--border)',
        animationDelay: `${index * 0.06}s`,
      }}
    >
      {/* Зона картинки / эмодзи */}
      <div
        className="h-36 flex items-center justify-center relative overflow-hidden"
        style={{ background: product.image_url ? 'transparent' : 'var(--apex-emoji-bg)' }}
      >
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-contain"
          />
        ) : (
          <span className="text-5xl">{product.emoji || <span style={{ color: '#ccc' }}>?</span>}</span>
        )}
        {outOfStock && (
          <span
            className="absolute top-3 left-3 text-[10px] font-bold px-2.5 py-1 rounded-lg"
            style={{ background: 'var(--apex-danger)', color: 'white' }}
          >
            Нет в наличии
          </span>
        )}
        {product.category.is_physical && product.stock !== null && product.stock > 0 && product.stock <= 5 && (
          <span
            className="absolute top-3 left-3 text-[10px] font-bold px-2.5 py-1 rounded-lg"
            style={{ background: 'var(--apex-warning-text)', color: 'white' }}
          >
            Осталось: {product.stock}
          </span>
        )}
      </div>

      {/* Детали товара */}
      <div className="p-4 flex flex-col flex-1" style={{ background: 'var(--surface-elevated)' }}>
        <div className="mb-1">
          <span className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
            {product.category.name}
          </span>
          {categoryDescription && (
            <span className="text-[10px] ml-1" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
              — {categoryDescription}
            </span>
          )}
        </div>
        <h3
          className="text-[13px] font-bold leading-snug"
          style={{ color: 'var(--text-primary)' }}
        >
          {product.name}
        </h3>
        {product.description && (
          <p
            className="text-[11px] mt-0.5 mb-2 line-clamp-2 hover:line-clamp-none cursor-default transition-all"
            style={{ color: 'var(--text-muted)' }}
          >
            {product.description}
          </p>
        )}
        {!product.description && <div className="mb-3" />}

        <div className="mt-auto pt-2">
        <PurchaseButton
          productId={product.id}
          price={product.price}
          canAfford={canAfford}
          outOfStock={outOfStock}
          deficit={deficit}
          onPurchase={onPurchase}
          isPurchasing={isPurchasing}
          shieldNoPending={isShield && !hasActivePending}
        />
        </div>
      </div>
    </div>
  )
}
