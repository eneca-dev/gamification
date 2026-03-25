'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { CoinStatic } from '@/components/CoinBalance'

import type { ShopOrderWithDetails, OrderStatus } from '../types'

const STATUS_CONFIG: Record<OrderStatus, { label: string; bg: string; text: string }> = {
  pending: { label: 'Ожидает', bg: 'var(--apex-warning-bg)', text: 'var(--apex-warning-text)' },
  processing: { label: 'В работе', bg: 'var(--apex-info-bg)', text: 'var(--apex-info-text)' },
  fulfilled: { label: 'Выполнен', bg: 'var(--apex-success-bg)', text: 'var(--apex-success-text)' },
  cancelled: { label: 'Отменён', bg: 'var(--apex-error-bg)', text: 'var(--apex-error-text)' },
}

const FILTER_OPTIONS: { value: 'all' | OrderStatus; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'pending', label: 'Ожидают' },
  { value: 'processing', label: 'В работе' },
  { value: 'fulfilled', label: 'Выполнены' },
  { value: 'cancelled', label: 'Отменены' },
]

interface OrdersClientProps {
  orders: ShopOrderWithDetails[]
}

export function OrdersClient({ orders }: OrdersClientProps) {
  const [filter, setFilter] = useState<'all' | OrderStatus>('all')

  const filtered = filter === 'all' ? orders : orders.filter((o) => o.status === filter)

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="animate-fade-in-up flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
            Мои заказы
          </h1>
          <p className="text-sm font-medium mt-1" style={{ color: 'var(--text-secondary)' }}>
            История покупок и статусы заказов
          </p>
        </div>
        <Link
          href="/store"
          className="px-4 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200"
          style={{
            background: 'var(--apex-primary)',
            color: 'white',
          }}
        >
          В магазин <ArrowRight size={14} strokeWidth={2.5} className="inline ml-1 -translate-y-[0.5px]" />
        </Link>
      </div>

      {/* Фильтры */}
      <div className="animate-fade-in-up stagger-1 flex gap-2 flex-wrap">
        {FILTER_OPTIONS.map((opt) => {
          const isActive = filter === opt.value
          return (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className="px-4 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200"
              style={{
                background: isActive ? 'var(--apex-primary)' : 'var(--surface-elevated)',
                color: isActive ? 'white' : 'var(--text-secondary)',
                border: isActive ? 'none' : '1px solid var(--border)',
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>

      {/* Список заказов */}
      {filtered.length > 0 ? (
        <div className="space-y-3 animate-fade-in-up stagger-2">
          {filtered.map((order) => {
            const status = STATUS_CONFIG[order.status]
            const date = new Date(order.created_at)

            return (
              <div
                key={order.id}
                className="rounded-2xl p-4 flex items-center gap-4"
                style={{
                  background: 'var(--surface-elevated)',
                  border: '1px solid var(--border)',
                }}
              >
                {/* Эмодзи / картинка */}
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                >
                  {order.product.image_url ? (
                    <img
                      src={order.product.image_url}
                      alt={order.product.name}
                      className="w-full h-full object-cover rounded-xl"
                    />
                  ) : (
                    order.product.emoji || <span style={{ color: '#ccc', fontSize: '16px' }}>?</span>
                  )}
                </div>

                {/* Детали */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3
                      className="text-[14px] font-bold truncate"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {order.product.name}
                    </h3>
                    <span
                      className="text-[11px] font-bold px-2 py-0.5 rounded-md flex-shrink-0"
                      style={{ background: status.bg, color: status.text }}
                    >
                      {status.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className="text-[12px] font-medium"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    <CoinStatic amount={order.coins_spent} size="sm" />
                  </div>
                  {order.note && (
                    <p
                      className="text-[12px] mt-1 italic"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {order.note}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div
          className="text-center py-16 rounded-2xl animate-fade-in-up stagger-2"
          style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
        >
          <div className="text-4xl mb-3">🛍️</div>
          <p className="text-[14px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
            {filter === 'all' ? 'У вас пока нет заказов' : 'Заказов с таким статусом нет'}
          </p>
          <Link
            href="/store"
            className="inline-block mt-4 px-5 py-2.5 rounded-xl text-[13px] font-bold text-white transition-all"
            style={{ background: 'var(--apex-primary)' }}
          >
            Перейти в магазин <ArrowRight size={14} strokeWidth={2.5} className="inline ml-1 -translate-y-[-1px]" />
          </Link>
        </div>
      )}
    </div>
  )
}
