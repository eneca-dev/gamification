'use client'

import { CoinStatic } from '@/components/CoinBalance'

import { PurchaseButton } from './PurchaseButton'
import type { ShopProductWithCategory } from '../types'

interface ProductCardProps {
  product: ShopProductWithCategory
  balance: number
  index: number
  onPurchase: (productId: string, price: number) => void
  isPurchasing: boolean
}

export function ProductCard({ product, balance, index, onPurchase, isPurchasing }: ProductCardProps) {
  const canAfford = balance >= product.price
  const outOfStock = product.category.is_physical && product.stock !== null && product.stock === 0
  const deficit = product.price - balance

  return (
    <div
      className={`rounded-2xl overflow-hidden card-hover stagger-${Math.min(index + 1, 6)}`}
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
      <div className="p-4" style={{ background: 'var(--surface-elevated)' }}>
        <div
          className="text-[11px] font-semibold mb-1"
          style={{ color: 'var(--text-muted)' }}
        >
          {product.category.name}
        </div>
        <h3
          className="text-[13px] font-bold leading-snug mb-3"
          style={{ color: 'var(--text-primary)', minHeight: '36px' }}
        >
          {product.name}
        </h3>

        <div className="flex items-center justify-between mb-3">
          <CoinStatic amount={product.price} size="sm" />
        </div>

        <PurchaseButton
          productId={product.id}
          price={product.price}
          canAfford={canAfford}
          outOfStock={outOfStock}
          deficit={deficit}
          onPurchase={onPurchase}
          isPurchasing={isPurchasing}
        />
      </div>
    </div>
  )
}
