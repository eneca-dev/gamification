'use client'

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'

import { CoinStatic } from '@/components/CoinBalance'
import { updateOrderStatus, cancelOrder } from '@/modules/admin/index.client'

import type { AdminOrderRow } from '../types'

type StatusFilter = 'all' | 'pending' | 'processing' | 'fulfilled' | 'cancelled'

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  pending: { label: 'Ожидает', bg: 'var(--apex-warning-bg)', text: 'var(--apex-warning-text)' },
  processing: { label: 'В работе', bg: 'var(--apex-info-bg)', text: 'var(--apex-info-text)' },
  fulfilled: { label: 'Выполнен', bg: 'var(--apex-success-bg)', text: 'var(--apex-success-text)' },
  cancelled: { label: 'Отменён', bg: 'var(--apex-error-bg)', text: 'var(--apex-error-text)' },
}

const FILTER_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'pending', label: 'Ожидают' },
  { value: 'processing', label: 'В работе' },
  { value: 'fulfilled', label: 'Выполнены' },
  { value: 'cancelled', label: 'Отменены' },
]

const STATUS_TRANSITIONS: Record<string, { value: string; label: string }[]> = {
  pending: [
    { value: 'processing', label: 'В работу' },
    { value: 'fulfilled', label: 'Выполнен' },
  ],
  processing: [
    { value: 'pending', label: 'Вернуть в ожидание' },
    { value: 'fulfilled', label: 'Выполнен' },
  ],
  fulfilled: [
    { value: 'pending', label: 'Вернуть в ожидание' },
  ],
}

interface AdminOrdersClientProps {
  orders: AdminOrderRow[]
}

export function AdminOrdersClient({ orders: initial }: AdminOrdersClientProps) {
  const [orders, setOrders] = useState(initial)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [notification, setNotification] = useState<string | null>(null)
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null)

  // Подтверждение отмены
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [cancelNote, setCancelNote] = useState('')

  const filtered = filter === 'all' ? orders : orders.filter((o) => o.status === filter)

  const counts = {
    all: orders.length,
    pending: orders.filter((o) => o.status === 'pending').length,
    processing: orders.filter((o) => o.status === 'processing').length,
    fulfilled: orders.filter((o) => o.status === 'fulfilled').length,
    cancelled: orders.filter((o) => o.status === 'cancelled').length,
  }

  function showNotification(msg: string) {
    setNotification(msg)
    setTimeout(() => setNotification(null), 3000)
  }

  function handleStatusChange(orderId: string, newStatus: string) {
    const prev = orders
    setPendingOrderId(orderId)
    setOrders((list) =>
      list.map((o) =>
        o.id === orderId
          ? { ...o, status: newStatus as AdminOrderRow['status'], status_changed_at: new Date().toISOString() }
          : o
      )
    )

    startTransition(async () => {
      const result = await updateOrderStatus({ orderId, status: newStatus })
      setPendingOrderId(null)
      if (!result.success) {
        setOrders(prev)
        setError(result.error)
      } else {
        showNotification(`Статус изменён на "${STATUS_CONFIG[newStatus]?.label}"`)
      }
    })
  }

  function handleCancelOrder(orderId: string) {
    const prev = orders
    setPendingOrderId(orderId)
    setOrders((list) =>
      list.map((o) =>
        o.id === orderId
          ? { ...o, status: 'cancelled' as const, note: cancelNote || o.note, status_changed_at: new Date().toISOString() }
          : o
      )
    )
    setCancellingId(null)
    setCancelNote('')

    startTransition(async () => {
      const result = await cancelOrder({ orderId, note: cancelNote || null })
      setPendingOrderId(null)
      if (!result.success) {
        setOrders(prev)
        setError(result.error)
      } else {
        showNotification('Заказ отменён, коины возвращены')
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Toast */}
      {notification && (
        <div className="fixed top-6 right-6 z-50 animate-fade-in-up">
          <div
            className="rounded-xl px-5 py-3 text-[13px] font-semibold shadow-lg"
            style={{
              background: 'var(--apex-success-bg)',
              color: 'var(--apex-success-text)',
              border: '1px solid rgba(var(--apex-primary-rgb), 0.15)',
            }}
          >
            {notification}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          className="rounded-xl px-5 py-3 text-[13px] font-medium"
          style={{ background: 'var(--apex-error-bg)', color: 'var(--apex-danger)' }}
        >
          {error}
          <button onClick={() => setError(null)} className="ml-3 font-bold">x</button>
        </div>
      )}

      {/* Фильтры */}
      <div className="flex gap-2 flex-wrap">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className="px-4 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200"
            style={{
              background: filter === tab.value ? 'var(--apex-primary)' : 'var(--apex-surface)',
              color: filter === tab.value ? 'white' : 'var(--apex-text-secondary)',
              border: filter === tab.value ? 'none' : '1px solid var(--apex-border)',
            }}
          >
            {tab.label} ({counts[tab.value]})
          </button>
        ))}
      </div>

      {/* Таблица */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
      >
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--apex-border)' }}>
              {['Покупатель', 'Товар', 'Сумма', 'Статус', 'Дата', 'Действия'].map((h) => (
                <th
                  key={h}
                  className="text-left text-[12px] font-semibold px-5 py-3"
                  style={{ color: 'var(--apex-text-secondary)' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12">
                  <p className="text-[13px] font-medium" style={{ color: 'var(--apex-text-muted)' }}>
                    Нет заказов
                  </p>
                </td>
              </tr>
            ) : (
              filtered.map((order) => {
                const status = STATUS_CONFIG[order.status]
                const transitions = STATUS_TRANSITIONS[order.status] ?? []
                const isCancelled = order.status === 'cancelled'
                const isOrderPending = pendingOrderId === order.id
                const date = new Date(order.created_at)

                return (
                  <tr key={order.id} style={{ borderBottom: '1px solid var(--apex-border)' }}>
                    {/* Покупатель */}
                    <td className="px-5 py-3">
                      <div>
                        <span className="text-[13px] font-semibold" style={{ color: 'var(--apex-text)' }}>
                          {order.user_name}
                        </span>
                        <p className="text-[11px]" style={{ color: 'var(--apex-text-muted)' }}>
                          {order.user_email}
                        </p>
                      </div>
                    </td>

                    {/* Товар */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        {order.product_emoji && (
                          <span className="text-lg">{order.product_emoji}</span>
                        )}
                        <span className="text-[13px] font-medium" style={{ color: 'var(--apex-text)' }}>
                          {order.product_name}
                        </span>
                      </div>
                    </td>

                    {/* Сумма */}
                    <td className="px-5 py-3">
                      <CoinStatic amount={order.coins_spent} size="sm" />
                    </td>

                    {/* Статус */}
                    <td className="px-5 py-3">
                      <span
                        className="text-[11px] font-bold px-2.5 py-1 rounded-md"
                        style={{ background: status.bg, color: status.text }}
                      >
                        {status.label}
                      </span>
                      {order.note && (
                        <p className="text-[11px] mt-1 italic max-w-[150px] truncate" style={{ color: 'var(--apex-text-muted)' }}>
                          {order.note}
                        </p>
                      )}
                    </td>

                    {/* Дата */}
                    <td className="px-5 py-3">
                      <span className="text-[12px]" style={{ color: 'var(--apex-text-secondary)' }}>
                        {date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      <p className="text-[11px]" style={{ color: 'var(--apex-text-muted)' }}>
                        {date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </td>

                    {/* Действия */}
                    <td className="px-5 py-3">
                      {isCancelled ? (
                        <span className="text-[11px]" style={{ color: 'var(--apex-text-muted)' }}>—</span>
                      ) : isOrderPending ? (
                        <Loader2 size={16} className="animate-spin" style={{ color: 'var(--apex-text-muted)' }} />
                      ) : (
                        <div className="flex items-center gap-2">
                          {/* Смена статуса */}
                          {transitions.length > 0 && (
                            <select
                              value=""
                              onChange={(e) => {
                                if (e.target.value) handleStatusChange(order.id, e.target.value)
                              }}
                              className="px-2 py-1 rounded-lg text-[11px] font-medium outline-none cursor-pointer"
                              style={{
                                background: 'var(--apex-bg)',
                                border: '1px solid var(--apex-border)',
                                color: 'var(--apex-text-secondary)',
                              }}
                            >
                              <option value="">Статус...</option>
                              {transitions.map((t) => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                              ))}
                            </select>
                          )}

                          {/* Отмена */}
                          <button
                            onClick={() => setCancellingId(order.id)}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors"
                            style={{
                              background: 'var(--apex-error-bg)',
                              color: 'var(--apex-danger)',
                              border: '1px solid transparent',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'var(--apex-danger)'
                              e.currentTarget.style.color = 'white'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'var(--apex-error-bg)'
                              e.currentTarget.style.color = 'var(--apex-danger)'
                            }}
                          >
                            Отменить
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>

        <div className="px-5 py-3 text-[12px] font-medium" style={{ color: 'var(--apex-text-muted)' }}>
          {filtered.length} из {orders.length} заказов
        </div>
      </div>

      {/* Модал подтверждения отмены */}
      {cancellingId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => { setCancellingId(null); setCancelNote('') }}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full max-w-sm rounded-2xl p-6 animate-scale-in"
            style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[15px] font-bold mb-3" style={{ color: 'var(--apex-text)' }}>
              Отменить заказ?
            </h3>
            <p className="text-[13px] mb-4" style={{ color: 'var(--apex-text-secondary)' }}>
              Коины будут возвращены покупателю. Это действие нельзя отменить.
            </p>
            <textarea
              value={cancelNote}
              onChange={(e) => setCancelNote(e.target.value)}
              placeholder="Комментарий (опционально)"
              className="w-full px-3 py-2 rounded-lg text-[13px] outline-none resize-none mb-4"
              style={{
                background: 'var(--apex-bg)',
                border: '1px solid var(--apex-border)',
                color: 'var(--apex-text)',
              }}
              rows={2}
            />
            <div className="flex gap-3">
              <button
                onClick={() => handleCancelOrder(cancellingId)}
                disabled={isPending}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold"
                style={{
                  background: 'var(--apex-danger)',
                  color: 'white',
                  opacity: isPending ? 0.6 : 1,
                }}
              >
                Отменить заказ
              </button>
              <button
                onClick={() => { setCancellingId(null); setCancelNote('') }}
                className="px-6 py-2.5 rounded-xl text-[13px] font-semibold"
                style={{
                  background: 'var(--apex-bg)',
                  color: 'var(--apex-text-secondary)',
                  border: '1px solid var(--apex-border)',
                }}
              >
                Назад
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
