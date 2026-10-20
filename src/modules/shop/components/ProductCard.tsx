'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Play } from 'lucide-react'

import { CoinIcon } from '@/components/CoinIcon'
import { PurchaseButton } from './PurchaseButton'
import { ProductMediaGallery } from './ProductMediaGallery'
import { hasVideo, mediaPoster } from '../media'
import { computeDisplayDiscount, computePriceWithoutDiscount } from '../types'
import type { ShopProductWithCategory } from '../types'
import type { ShieldQuota, ShieldType } from '@/modules/streak-shield/index.client'

interface ProductCardProps {
  product: ShopProductWithCategory
  balance: number
  index: number
  onPurchase: (productId: string, price: number, userComment?: string) => void
  isPurchasing: boolean
  categoryDescription?: string | null
  shieldQuota?: ShieldQuota | null
  shieldCredits: Record<ShieldType, number>
}

export function ProductCard({ product, balance, index, onPurchase, isPurchasing, categoryDescription, shieldQuota = null, shieldCredits }: ProductCardProps) {
  const outOfStock = !product.is_coming_soon && product.category.is_countable && product.stock !== null && product.stock === 0

  // Карусель медиа на карточке: hover по точке снизу → активный элемент; клик по картинке → галерея
  const media = product.media ?? []
  const [activeIdx, setActiveIdx] = useState(0)
  const safeIdx = Math.min(activeIdx, Math.max(media.length - 1, 0))
  const activeItem = media[safeIdx] ?? null
  const activePoster = activeItem ? mediaPoster(activeItem) : null
  const previewSrc = activePoster ?? product.image_url ?? null
  const activeIsVideo = activeItem?.kind === 'youtube' || activeItem?.kind === 'video'
  const videoInside = hasVideo(media)
  const [isGalleryOpen, setIsGalleryOpen] = useState(false)
  const closeGallery = useCallback(() => setIsGalleryOpen(false), [])

  // Щит покупается заранее по обычной цене; бесплатные применения расходуются при угрозе.
  const shieldEffect = product.effect
  const isShield = shieldEffect === 'streak_shield_ws' || shieldEffect === 'streak_shield_revit'
  const shieldType = shieldEffect === 'streak_shield_ws' ? 'ws' : 'revit'
  const freeLeft = isShield && shieldQuota ? shieldQuota[shieldType].freeLeft : null

  const canAfford = balance >= product.price
  const deficit = product.price - balance

  // Раскрытие описания по клику. isTruncated нужен только для курсора
  const descRef = useRef<HTMLParagraphElement>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isTruncated, setIsTruncated] = useState(false)

  useEffect(() => {
    const el = descRef.current
    if (!el || isExpanded) return
    const check = () => {
      setIsTruncated(el.scrollHeight > el.clientHeight + 1)
    }
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [product.description, isExpanded])

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
      <button
        type="button"
        disabled={media.length === 0}
        aria-label={`Открыть медиа товара ${product.name}`}
        className="h-32 w-full flex items-center justify-center relative overflow-hidden group"
        style={{
          background: previewSrc ? 'transparent' : 'var(--apex-emoji-bg)',
          cursor: media.length > 0 ? 'zoom-in' : 'default',
        }}
        onClick={() => { if (media.length > 0) setIsGalleryOpen(true) }}
        onMouseLeave={() => setActiveIdx(0)}
      >
        {previewSrc ? (
          <img
            src={previewSrc}
            alt={product.name}
            className="w-full h-full object-contain transition-opacity duration-150"
            key={safeIdx}
          />
        ) : (
          <span className="text-5xl">{product.emoji || <span style={{ color: '#ccc' }}>?</span>}</span>
        )}
        {activeIsVideo && previewSrc && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(0, 0, 0, 0.55)' }}>
              <Play size={16} fill="white" color="white" />
            </div>
          </div>
        )}
        {product.is_coming_soon && (
          <span
            className="absolute top-3 left-3 text-[10px] font-bold px-2.5 py-1 rounded-lg"
            style={{ background: 'var(--apex-warning-text)', color: 'white' }}
          >
            Скоро в продаже
          </span>
        )}
        {outOfStock && (
          <span
            className="absolute top-3 left-3 text-[10px] font-bold px-2.5 py-1 rounded-lg"
            style={{ background: 'var(--apex-danger)', color: 'white' }}
          >
            Нет в наличии
          </span>
        )}
        {!product.is_coming_soon && product.category.is_countable && product.stock !== null && product.stock > 0 && product.stock <= 5 && (
          <span
            className="absolute top-3 left-3 text-[10px] font-bold px-2.5 py-1 rounded-lg"
            style={{ background: 'var(--apex-warning-text)', color: 'white' }}
          >
            Осталось: {product.stock}
          </span>
        )}
        {!product.is_coming_soon && product.discount_percent !== null && (
          <span
            className="absolute top-3 right-3 text-[12px] font-black px-2.5 py-1 rounded-lg"
            style={{ background: 'var(--apex-gold)', color: 'white' }}
          >
            −{computeDisplayDiscount(product.discount_percent)}%
          </span>
        )}
      </button>

      {/* Ряд точек-пилюль под фото. Всегда резервирует высоту, чтобы карточка не прыгала. */}
      <div className="h-4 flex items-center justify-center" style={{ background: 'var(--surface-elevated)' }}>
        {media.length > 1 && (
          <div className="flex items-center gap-1.5">
            {media.map((_, i) => (
              <button
                key={i}
                type="button"
                onMouseEnter={() => setActiveIdx(i)}
                onFocus={() => setActiveIdx(i)}
                onClick={(e) => { e.stopPropagation(); setActiveIdx(i); setIsGalleryOpen(true) }}
                className="transition-all rounded-full"
                style={{
                  width: i === safeIdx ? 14 : 6,
                  height: 6,
                  background: i === safeIdx ? 'var(--apex-primary)' : 'var(--border)',
                }}
                aria-label={`Медиа ${i + 1}`}
              />
            ))}
          </div>
        )}
        {media.length <= 1 && videoInside && (
          <Play size={10} fill="currentColor" style={{ color: 'var(--text-muted)' }} />
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
            ref={descRef}
            onClick={() => setIsExpanded((v) => !v)}
            className={`text-[11px] mt-0.5 mb-2 overflow-hidden ${
              isTruncated || isExpanded ? 'cursor-pointer' : 'cursor-default'
            }`}
            style={{
              color: 'var(--text-muted)',
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: isExpanded ? 'unset' : 2,
            }}
          >
            {product.description}
          </p>
        )}
        {!product.description && <div className="mb-3" />}


        <div className="mt-auto pt-2">
        {isShield && (
          <p className="text-center text-[11px] mb-2" style={{ color: 'var(--apex-text-secondary)' }}>
            Куплено: {shieldCredits[shieldType]} · Бесплатно в этом месяце: {freeLeft ?? 0}
          </p>
        )}
        {!product.is_coming_soon && product.discount_percent !== null && (
          <div className="flex items-center justify-center gap-1 mb-1.5">
            <span
              className="text-[12px] line-through flex items-center gap-0.5"
              style={{ color: 'var(--apex-text-muted)' }}
            >
              {computePriceWithoutDiscount(product.price, product.discount_percent).toLocaleString('ru-RU')}&nbsp;<CoinIcon size={10} />
            </span>
          </div>
        )}
        <PurchaseButton
          productId={product.id}
          productName={product.name}
          price={product.price}
          canAfford={canAfford}
          outOfStock={outOfStock}
          deficit={deficit}
          onPurchase={onPurchase}
          isPurchasing={isPurchasing}
          isFree={false}
          comingSoon={product.is_coming_soon}
          hasDiscount={product.discount_percent !== null}
          commentRequired={product.comment_required}
          commentLabel={product.comment_label}
          commentPlaceholder={product.comment_placeholder}
        />
        </div>
      </div>

      {isGalleryOpen && media.length > 0 && (
        <ProductMediaGallery
          media={media}
          title={product.name}
          initialIndex={safeIdx}
          onClose={closeGallery}
        />
      )}
    </div>
  )
}
