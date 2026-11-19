'use client'

import { useState, useTransition, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQueryClient, queryKeys, refreshQueries } from '@/modules/cache'
import { useBalance } from '../hooks/useBalance'
import { storeCategoryUrl, type StoreTab } from '../navigation'
import { ArrowRight } from 'lucide-react'

import { purchaseProduct } from '../actions'
import { purchaseStreakShieldCredit } from '@/modules/streak-shield/index.client'
import { ProductCard } from './ProductCard'
// [LOTTERY HIDDEN] import { LotteryBanner } from '@/modules/lottery/components/LotteryBanner'
// [LOTTERY HIDDEN] import { LotteryWinners } from '@/modules/lottery/components/LotteryWinners'
import type { ShopProductWithCategory, ShopCategory } from '../types'
import type { ShieldQuota, ShieldType } from '@/modules/streak-shield/index.client'
// [LOTTERY HIDDEN] import type { LotteryWithStats, UserTicketInfo } from '@/modules/lottery/index.client'

interface StoreClientProps {
  showBimo?: boolean
  /** Вкладка рулетки показывается только при включённом переключателе в админке. */
  showRoulette?: boolean
  activeTab: StoreTab
  userId: string | null
  rouletteContent?: ReactNode
  bimoContent?: ReactNode
  /** Мини-Бимо для плашки категории. Готовый узел: модуль магазина не рендерит Бимо сам. */
  bimoTabIcon?: ReactNode
  /** Фон текущего образа: им подкрашивается плашка категории. */
  bimoTabTint?: string | null
  initialCategory?: string
  products: ShopProductWithCategory[]
  categories: ShopCategory[]
  balance: number
  shieldQuota?: ShieldQuota | null
  shieldCredits: Record<ShieldType, number>
  // [LOTTERY HIDDEN] activeLottery?: LotteryWithStats | null
  // [LOTTERY HIDDEN] ticketInfo?: UserTicketInfo | null
  // [LOTTERY HIDDEN] lotteryHistory?: LotteryWithStats[]
  // [LOTTERY HIDDEN] serverTime?: number
}

export function StoreClient({
  showBimo = false,
  showRoulette = false,
  activeTab,
  userId,
  rouletteContent,
  bimoContent,
  bimoTabIcon = null,
  bimoTabTint = null,
  initialCategory,
  products,
  categories,
  balance,
  shieldQuota = null,
  shieldCredits,
  // [LOTTERY HIDDEN] activeLottery = null,
  // [LOTTERY HIDDEN] ticketInfo = null,
  // [LOTTERY HIDDEN] lotteryHistory = [],
  // [LOTTERY HIDDEN] serverTime = Date.now(),
}: StoreClientProps) {
  const router = useRouter()
  const activeFilter = activeTab === 'catalog' ? initialCategory ?? 'all' : activeTab
  const balanceQuery = useBalance(userId ?? '', { enabled: activeTab === 'catalog' && Boolean(userId) })
  const currentBalance = balanceQuery.data ?? balance
  const [purchasingId, setPurchasingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const queryClient = useQueryClient()

  const filtered = (activeFilter === 'all'
    ? products
    : products.filter((p) => p.category.slug === activeFilter)
  )
    // Товары «Скоро в продаже» — в самый низ, остальной порядок сохраняем
    .slice()
    .sort((a, b) => Number(a.is_coming_soon) - Number(b.is_coming_soon))

  const activeCategory = categories.find((c) => c.slug === activeFilter)

  function selectFilter(filter: string) {
    router.push(storeCategoryUrl(filter))
  }

  function handlePurchase(productId: string, _price: number, userComment?: string) {
    if (balanceQuery.isError || balanceQuery.isFetching) {
      setNotification({ type: 'error', message: 'Сначала дождитесь актуального баланса' })
      return
    }
    const product = products.find((p) => p.id === productId)
    const effect = product?.effect

    // Предоплаченная защита сохраняется до появления угрозы стрику.
    if (effect === 'streak_shield_ws' || effect === 'streak_shield_revit') {
      const shieldType = effect === 'streak_shield_ws' ? 'ws' : 'revit'
      setPurchasingId(productId)
      setNotification(null)
      startTransition(async () => {
        const result = await purchaseStreakShieldCredit(shieldType)
        setPurchasingId(null)
        if (!result.success) {
          setNotification({ type: 'error', message: result.error })
        } else {
          setNotification({ type: 'success', message: 'Защита куплена и доступна для применения' })
          void refreshQueries(queryClient, [queryKeys.balance.all]).catch(() => {})
          window.location.reload()
        }
        setTimeout(() => setNotification(null), 3000)
      })
      return
    }

    setPurchasingId(productId)
    setNotification(null)

    startTransition(async () => {
      const result = await purchaseProduct({ product_id: productId, user_comment: userComment ?? null })
      setPurchasingId(null)

      if (!result.success) {
        setNotification({ type: 'error', message: result.error })
      } else {
        setNotification({ type: 'success', message: 'Покупка совершена!' })
        void refreshQueries(queryClient, [queryKeys.balance.all]).catch(() => {})
        void refreshQueries(queryClient, [queryKeys.orders.all]).catch(() => {})
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
            Обменивайте 💎 на реальные товары
          </p>
        </div>
        <Link
          href="/store/orders"
          data-onboarding="store-my-orders"
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
      <div className="animate-fade-in-up stagger-2 flex gap-2 flex-wrap" data-onboarding="store-category-filters">
        <button
          onClick={() => selectFilter('all')}
          className="px-4 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200"
          style={{
            background: activeFilter === 'all' ? 'var(--apex-primary)' : 'var(--surface-elevated)',
            color: activeFilter === 'all' ? 'white' : 'var(--text-secondary)',
            border: activeFilter === 'all' ? '1px solid transparent' : '1px solid var(--border)',
          }}
        >
          Все
        </button>
        {categories.map((cat) => {
          const isActive = activeFilter === cat.slug
          const isDraw = cat.slug === 'draw'
          return (
            <button
              key={cat.id}
              onClick={() => selectFilter(cat.slug)}
              data-onboarding-category={cat.slug}
              className={`py-2 rounded-xl text-[13px] font-semibold transition-all duration-200${isDraw ? ' relative overflow-hidden' : ' px-4'}`}
              style={isDraw ? {
                paddingLeft: '2rem',
                paddingRight: '1rem',
                background: 'var(--apex-warning-bg)',
                color: 'var(--apex-warning-dark)',
                border: isActive ? '1px solid var(--apex-gold)' : '1px solid transparent',
                opacity: isActive ? 1 : 0.75,
              } : {
                background: isActive ? 'var(--apex-primary)' : 'var(--surface-elevated)',
                color: isActive ? 'white' : 'var(--text-secondary)',
                border: isActive ? '1px solid transparent' : '1px solid var(--border)',
              }}
            >
              {isDraw && (
                <>
                  {/* Корешок */}
                  <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '12px', background: 'var(--apex-gold)', pointerEvents: 'none' }} />
                  {/* Верхний полукруг */}
                  <span style={{ position: 'absolute', left: '8px', top: '6px', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--apex-warning-bg)', pointerEvents: 'none', zIndex: 1 }} />
                  {/* Нижний полукруг */}
                  <span style={{ position: 'absolute', left: '8px', bottom: '6px', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--apex-warning-bg)', pointerEvents: 'none', zIndex: 1 }} />
                </>
              )}
              {cat.name}
            </button>
          )
        })}
        {showRoulette && <button
          type="button"
          onClick={() => router.push('/store?tab=roulette')}
          aria-pressed={activeTab === 'roulette'}
          className="px-4 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200"
          style={{
            background: activeTab === 'roulette' ? 'var(--apex-primary)' : 'var(--surface-elevated)',
            color: activeTab === 'roulette' ? 'white' : 'var(--text-secondary)',
            border: activeTab === 'roulette' ? '1px solid transparent' : '1px solid var(--border)',
          }}
        >Рулетка</button>}
        {showBimo && <button
          type="button"
          onClick={() => router.push('/store?tab=bimo')}
          aria-pressed={activeFilter === 'bimo'}
          // Плашка Бимо отличается от остальных: слева сам енот, а тон плашки —
          // размытый фон его текущего образа, поэтому она меняется вместе с образом.
          // Размер совпадает с остальными плашками: иконка вписана в строку,
          // высоту не увеличивает. Активная отмечается цветом рамки, а не толщиной.
          className={`relative flex items-center gap-1.5 overflow-hidden rounded-xl py-2 text-[13px] font-semibold transition-all duration-200 ${bimoTabIcon ? 'pl-2 pr-4' : 'px-4'}`}
          style={{
            background: bimoTabTint ? 'var(--surface-elevated)' : activeFilter === 'bimo' ? 'var(--apex-primary)' : 'var(--surface-elevated)',
            color: !bimoTabTint && activeFilter === 'bimo' ? 'white' : 'var(--text-secondary)',
            border: `1px solid ${activeFilter === 'bimo' ? 'var(--apex-primary)' : 'var(--border)'}`,
          }}
        >
          {bimoTabTint && <>
            <span aria-hidden="true" className="absolute inset-0 scale-150 bg-cover bg-center blur-md" style={{ backgroundImage: `url(${bimoTabTint})` }} />
            <span aria-hidden="true" className="bimo-band-veil absolute inset-0" />
          </>}
          {bimoTabIcon && <span aria-hidden="true" className="relative -my-1 h-6 w-6 flex-shrink-0">{bimoTabIcon}</span>}
          <span className="relative">Енот-Бимо</span>
        </button>}
      </div>

      {/* Описание категории */}
      {activeFilter !== 'all' && activeCategory?.description && (
        <div
          className="animate-fade-in-up rounded-xl px-4 py-3 text-[12px] font-medium"
          style={{
            background: 'var(--apex-success-bg)',
            border: '1px solid rgba(var(--apex-primary-rgb), 0.12)',
            color: 'var(--text-secondary)',
          }}
        >
          {activeCategory.description}
        </div>
      )}

      {/* Контент категории */}
      {/* [LOTTERY HIDDEN] activeFilter === 'draw' branch (LotteryBanner, LotteryWinners) removed */}
      {activeTab === 'roulette' ? rouletteContent : activeTab === 'bimo' ? bimoContent : filtered.length > 0 ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 animate-fade-in-up stagger-3">
          {filtered.map((product, i) => (
            <ProductCard
              key={product.id}
              product={product}
              balance={currentBalance}
              index={i}
              onPurchase={handlePurchase}
              isPurchasing={isPending && purchasingId === product.id}
              categoryDescription={activeFilter === 'all' ? categories.find((c) => c.slug === product.category.slug)?.description : null}
              shieldQuota={shieldQuota}
              shieldCredits={shieldCredits}
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
