'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Loader2 } from 'lucide-react'

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

const ALL_STATUSES = [
  { value: 'pending', label: 'Ожидает' },
  { value: 'processing', label: 'В работе' },
  { value: 'fulfilled', label: 'Выполнен' },
]

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

  // Дропдаун статуса
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)
  // Развёрнутые комментарии
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null)

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
    setOpenDropdownId(null)
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
      {/* Toast — через портал */}
      {notification && createPortal(
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
        </div>,
        document.body,
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
      <div className="flex gap-2 flex-wrap" data-onboarding="orders-filter-tabs">
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
        data-onboarding="admin-orders-table"
        style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
      >
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--apex-border)' }}>
              {['Покупатель', 'Товар', 'Сумма', 'Статус', 'Дата'].map((h) => (
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
                <td colSpan={5} className="text-center py-12">
                  <p className="text-[13px] font-medium" style={{ color: 'var(--apex-text-muted)' }}>
                    Нет заказов
                  </p>
                </td>
              </tr>
            ) : (
              filtered.map((order) => {
                const status = STATUS_CONFIG[order.status]
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
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-base overflow-hidden flex-shrink-0"
                          style={{
                            background: order.product_image_url ? 'var(--apex-bg)' : 'var(--apex-emoji-bg)',
                            border: '1px solid var(--apex-border)',
                          }}
                        >
                          {order.product_image_url ? (
                            <img src={order.product_image_url} alt="" className="w-full h-full object-cover" />
                          ) : order.product_emoji ? (
                            order.product_emoji
                          ) : (
                            <span style={{ color: '#ccc', fontSize: '12px' }}>?</span>
                          )}
                        </div>
                        <span className="text-[13px] font-medium" style={{ color: 'var(--apex-text)' }}>
                          {order.product_name}
                        </span>
                      </div>
                    </td>

                    {/* Сумма */}
                    <td className="px-5 py-3">
                      <CoinStatic amount={order.coins_spent} size="sm" />
                    </td>

                    {/* Статус — с дропдауном */}
                    <td className="px-5 py-3">
                      <div>
                        <div className="flex items-center gap-2">
                          {isOrderPending ? (
                            <span
                              className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-md"
                              style={{ background: status.bg, color: status.text }}
                            >
                              <Loader2 size={12} className="animate-spin" />
                              {status.label}
                            </span>
                          ) : isCancelled ? (
                            <span
                              className="text-[11px] font-bold px-2.5 py-1 rounded-md"
                              style={{ background: status.bg, color: status.text }}
                            >
                              {status.label}
                            </span>
                          ) : !order.is_physical ? (
                            <>
                              <span
                                className="text-[11px] font-bold px-2.5 py-1 rounded-md"
                                style={{ background: status.bg, color: status.text }}
                              >
                                {status.label}
                              </span>
                              <button
                                onClick={() => setCancellingId(order.id)}
                                className="px-2 py-1 rounded-md text-[11px] font-semibold transition-colors"
                                style={{ color: 'var(--apex-danger)' }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--apex-error-bg)' }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                              >
                                Отменить
                              </button>
                            </>
                          ) : (
                            <>
                              <StatusDropdown
                                currentStatus={order.status}
                                isOpen={openDropdownId === order.id}
                                onToggle={() => setOpenDropdownId(openDropdownId === order.id ? null : order.id)}
                                onSelect={(val) => handleStatusChange(order.id, val)}
                              />
                              <button
                                onClick={() => setCancellingId(order.id)}
                                className="px-2 py-1 rounded-md text-[11px] font-semibold transition-colors"
                                style={{ color: 'var(--apex-danger)' }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--apex-error-bg)' }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                              >
                                Отменить
                              </button>
                            </>
                          )}
                        </div>
                        {order.note && (
                          <p
                            className="text-[11px] mt-1 italic cursor-pointer max-w-[200px]"
                            style={{
                              color: 'var(--apex-text-muted)',
                              overflow: 'hidden',
                              display: expandedNoteId === order.id ? undefined : '-webkit-box',
                              WebkitLineClamp: expandedNoteId === order.id ? undefined : 1,
                              WebkitBoxOrient: expandedNoteId === order.id ? undefined : 'vertical',
                            }}
                            onClick={() => setExpandedNoteId(expandedNoteId === order.id ? null : order.id)}
                          >
                            {order.note}
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Дата — 1 строка */}
                    <td className="px-5 py-3">
                      <span className="text-[12px] whitespace-nowrap" style={{ color: 'var(--apex-text-secondary)' }}>
                        {date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}{', '}
                        {date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                      </span>
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
      {cancellingId && createPortal(
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
        </div>,
        document.body,
      )}
    </div>
  )
}

// --- Дропдаун смены статуса ---

function StatusDropdown({
  currentStatus,
  isOpen,
  onToggle,
  onSelect,
}: {
  currentStatus: string
  isOpen: boolean
  onToggle: () => void
  onSelect: (value: string) => void
}) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const current = STATUS_CONFIG[currentStatus]
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (!isOpen) return
    function handleClick(e: MouseEvent) {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        menuRef.current && !menuRef.current.contains(e.target as Node)
      ) onToggle()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen, onToggle])

  useEffect(() => {
    if (isOpen && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 6, left: rect.left })
    }
  }, [isOpen])

  return (
    <div className="inline-block">
      <button
        ref={btnRef}
        onClick={onToggle}
        className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-md cursor-pointer transition-opacity hover:opacity-80"
        style={{ background: current.bg, color: current.text }}
      >
        {current.label}
        <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[100] min-w-[160px] rounded-xl py-1.5 shadow-lg animate-scale-in"
          style={{
            top: pos.top,
            left: pos.left,
            background: 'var(--apex-surface)',
            border: '1px solid var(--apex-border)',
          }}
        >
          {ALL_STATUSES.map((s) => {
            const sc = STATUS_CONFIG[s.value]
            const isCurrent = s.value === currentStatus
            return (
              <button
                key={s.value}
                onClick={() => { if (!isCurrent) onSelect(s.value) }}
                className="w-full text-left px-4 py-2 text-[12px] font-medium transition-colors flex items-center gap-2.5"
                style={{
                  color: isCurrent ? sc.text : 'var(--apex-text)',
                  background: isCurrent ? sc.bg : 'transparent',
                  cursor: isCurrent ? 'default' : 'pointer',
                }}
                onMouseEnter={(e) => { if (!isCurrent) e.currentTarget.style.background = 'var(--apex-bg)' }}
                onMouseLeave={(e) => { if (!isCurrent) e.currentTarget.style.background = 'transparent' }}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: sc.text }}
                />
                {s.label}
              </button>
            )
          })}
        </div>,
        document.body,
      )}
    </div>
  )
}
