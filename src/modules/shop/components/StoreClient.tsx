'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { purchaseProduct } from '../actions'
import { ProductCard } from './ProductCard'
import type { ShopProductWithCategory, ShopCategory } from '../types'

interface StoreClientProps {
  products: ShopProductWithCategory[]
  categories: ShopCategory[]
  balance: number
}

export function StoreClient({ products, categories, balance }: StoreClientProps) {
  const [activeFilter, setActiveFilter] = useState('all')
  const [purchasingId, setPurchasingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const filtered = activeFilter === 'all'
    ? products
    : products.filter((p) => p.category.slug === activeFilter)

  const categoryDescriptions: Record<string, { icon: string; text: string }> = {
    upgrade: { icon: 'i', text: 'Оборудование из этой категории остается собственностью компании' },
    merch: { icon: '🎁', text: 'Товары из этой категории переходят в собственность сотрудника' },
  }

  const activeCategoryInfo = categoryDescriptions[activeFilter]

  function handlePurchase(productId: string, _price: number) {
    setPurchasingId(productId)
    setNotification(null)

    startTransition(async () => {
      const result = await purchaseProduct(productId)
      setPurchasingId(null)

      if (!result.success) {
        setNotification({ type: 'error', message: result.error })
      } else {
        setNotification({ type: 'success', message: 'Покупка совершена!' })
      }

      setTimeout(() => setNotification(null), 3000)
    })
  }

  return (
    <div className="space-y-6 relative">
      {/* Toast-уведомление — fixed, не сдвигает контент */}
      {notification && (
        <div className="fixed top-6 right-6 z-50 animate-fade-in-up">
          <div
            className="rounded-xl px-5 py-3 text-[13px] font-semibold shadow-lg"
            style={{
              background: notification.type === 'success' ? 'var(--apex-success-bg)' : 'var(--apex-error-bg)',
              color: notification.type === 'success' ? 'var(--apex-success-text)' : 'var(--apex-error-text)',
              border: `1px solid ${notification.type === 'success' ? 'rgba(var(--apex-primary-rgb), 0.15)' : 'rgba(220, 38, 38, 0.15)'}`,
            }}
          >
            {notification.message}
          </div>
        </div>
      )}

      {/* Заголовок */}
      <div className="animate-fade-in-up flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
            Магазин
          </h1>
          <p className="text-sm font-medium mt-1" style={{ color: 'var(--text-secondary)' }}>
            Обменивайте баллы на реальные награды
          </p>
        </div>
        <Link
          href="/store/orders"
          className="px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-200"
          style={{
            background: 'var(--surface-elevated)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border)',
          }}
        >
          Мои заказы <ArrowRight size={14} strokeWidth={2.5} className="inline ml-1 -translate-y-[0.5px]" />
        </Link>
      </div>

      {/* Фильтры категорий */}
      <div className="animate-fade-in-up stagger-2 flex gap-2 flex-wrap">
        <button
          onClick={() => setActiveFilter('all')}
          className="px-4 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200"
          style={{
            background: activeFilter === 'all' ? 'var(--apex-primary)' : 'var(--surface-elevated)',
            color: activeFilter === 'all' ? 'white' : 'var(--text-secondary)',
            border: activeFilter === 'all' ? 'none' : '1px solid var(--border)',
          }}
        >
          Все
        </button>
        {categories.map((cat) => {
          const isActive = activeFilter === cat.slug
          return (
            <button
              key={cat.id}
              onClick={() => setActiveFilter(cat.slug)}
              className="px-4 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200"
              style={{
                background: isActive ? 'var(--apex-primary)' : 'var(--surface-elevated)',
                color: isActive ? 'white' : 'var(--text-secondary)',
                border: isActive ? 'none' : '1px solid var(--border)',
              }}
            >
              {cat.name}
            </button>
          )
        })}
      </div>

      {/* Инфо-баннер категории */}
      {activeCategoryInfo && (
        <div
          className="animate-fade-in-up rounded-xl px-4 py-3 flex items-center gap-3 text-[12px] font-medium"
          style={{
            background: 'var(--apex-success-bg)',
            border: '1px solid rgba(var(--apex-primary-rgb), 0.12)',
            color: 'var(--text-secondary)',
          }}
        >
          <span className="text-base">{activeCategoryInfo.icon}</span>
          {activeCategoryInfo.text}
        </div>
      )}

      {/* Грид товаров */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-fade-in-up stagger-3">
          {filtered.map((product, i) => (
            <ProductCard
              key={product.id}
              product={product}
              balance={balance}
              index={i}
              onPurchase={handlePurchase}
              isPurchasing={isPending && purchasingId === product.id}
            />
          ))}
        </div>
      ) : (
        <div
          className="text-center py-16 rounded-2xl"
          style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
        >
          <div className="text-4xl mb-3">📦</div>
          <p className="text-[14px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
            В этой категории пока нет товаров
          </p>
        </div>
      )}
    </div>
  )
}
