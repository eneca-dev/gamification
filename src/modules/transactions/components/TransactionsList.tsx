'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, ExternalLink, XCircle, Briefcase, Building2, Heart, Trophy, Award, ShoppingBag, Tag, ArrowUpRight, ArrowDownLeft, Check } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { CoinIcon } from '@/components/CoinIcon'
import type { TransactionSubItem } from '../types'

interface BonusTaskItem {
  id: string
  name: string
  url?: string
  dateClosed?: string
}

export interface TransactionItem {
  id: string
  event_type: string
  source: string
  coins: number
  description: string
  icon: string
  dateFormatted: string
  subItems?: TransactionSubItem[]
  inlineLink?: TransactionSubItem
  productEmoji?: string
  productImageUrl?: string | null
  bonusTasks?: BonusTaskItem[]
  details?: Record<string, unknown> | null
  taskClosedAt?: string
}

interface TransactionsListProps {
  items: TransactionItem[]
  currentSort?: string
  sortHref?: string
  isPending?: boolean
  onNavigate?: (url: string) => void
  showId?: boolean
}

interface SourceConfig {
  icon: LucideIcon
  label: string
  bg: string
  color: string
}

const SOURCE_CONFIG: Record<string, SourceConfig> = {
  ws: { icon: Briefcase, label: 'Worksection', bg: 'var(--tag-blue-bg)', color: 'var(--tag-blue-text)' },
  revit: { icon: Building2, label: 'Revit', bg: 'var(--tag-orange-bg)', color: 'var(--tag-orange-text)' },
  gratitudes: { icon: Heart, label: 'Благодарности', bg: 'var(--tag-purple-bg)', color: 'var(--tag-purple-text)' },
  contest: { icon: Trophy, label: 'Соревнование', bg: 'var(--tag-yellow-bg)', color: 'var(--tag-yellow-text)' },
  achievements: { icon: Award, label: 'Достижения', bg: 'var(--tag-teal-bg)', color: 'var(--tag-teal-text)' },
  shop: { icon: ShoppingBag, label: 'Магазин', bg: 'var(--tag-gray-bg)', color: 'var(--tag-gray-text)' },
}

function getSourceConfig(source: string): SourceConfig {
  return SOURCE_CONFIG[source] ?? {
    icon: Tag,
    label: source,
    bg: 'var(--tag-gray-bg)',
    color: 'var(--tag-gray-text)',
  }
}

export function TransactionsList({ items, currentSort, sortHref, isPending = false, onNavigate, showId = false }: TransactionsListProps) {
  const [rotated, setRotated] = useState(currentSort === 'date_asc')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [copiedId, setCopiedId] = useState<string | null>(null)

  function handleCopyId(id: string) {
    navigator.clipboard.writeText(id)
    setCopiedId(id)
    setTimeout(() => setCopiedId(prev => prev === id ? null : prev), 2500)
  }

  useEffect(() => {
    setRotated(currentSort === 'date_asc')
  }, [currentSort])

  const handleSortClick = () => {
    if (!sortHref || !onNavigate) return
    setRotated(r => !r)
    onNavigate(sortHref)
  }

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-[13px]" style={{ color: 'var(--apex-text-muted)' }}>
        Нет операций
      </div>
    )
  }

  return (
    <div className="space-y-1" data-onboarding="transactions-list">
      <div
        className="hidden md:flex items-center gap-3 px-3 pb-2 mb-1"
        style={{ borderBottom: '1px solid var(--apex-border)' }}
      >
        <div className="w-9 flex-shrink-0" />
        <div
          className="flex-1 text-[13px] font-bold uppercase"
          style={{ color: 'var(--apex-text-muted)' }}
        >
          Операция
        </div>
        <div
          className="w-32 flex-shrink-0 text-[13px] font-bold uppercase"
          style={{ color: 'var(--apex-text-muted)' }}
        >
          Тип
        </div>
        {sortHref ? (
          <button
            onClick={handleSortClick}
            className="w-24 flex-shrink-0 inline-flex items-center gap-1 text-[13px] font-bold uppercase cursor-pointer hover:opacity-70 transition-opacity"
            style={{ color: 'var(--apex-text-muted)' }}
          >
            Дата
            <span
              style={{
                fontSize: '14px',
                lineHeight: 1,
                fontWeight: 100,
                display: 'inline-block',
                transform: rotated ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.3s ease',
              }}
            >⇅</span>
          </button>
        ) : (
          <div
            className="w-24 flex-shrink-0 text-[13px] font-bold uppercase"
            style={{ color: 'var(--apex-text-muted)' }}
          >
            Дата
          </div>
        )}
        <div className="w-24 flex-shrink-0 flex items-center justify-start">
          <CoinIcon size={18} />
        </div>
      </div>
      {isPending ? (
        <TransactionsListSkeleton />
      ) : items.map((tx, idx) => {
        const isNegative = tx.coins < 0
        const isZero = tx.coins === 0

        let amountColor = 'var(--apex-primary)'
        if (isNegative) amountColor = 'var(--apex-danger)'
        else if (isZero) amountColor = 'var(--apex-text-muted)'

        const iconBg = isNegative ? 'var(--apex-error-bg)' : 'var(--apex-bg)'
        const iconBorder = isNegative
          ? '1px solid rgba(220, 38, 38, 0.12)'
          : '1px solid var(--apex-border)'

        // Для покупок: emoji товара или image
        const showProductIcon = (tx.event_type === 'shop_purchase' || tx.event_type === 'shop_refund')
          && (tx.productEmoji || tx.productImageUrl)

        const iconContent = showProductIcon
          ? (tx.productImageUrl
            ? <img src={tx.productImageUrl} alt="" className="w-full h-full object-cover rounded-xl" />
            : tx.productEmoji)
          : tx.icon

        const hasBonusTasks = tx.bonusTasks != null && tx.bonusTasks.length > 0
        const isExpanded = expandedIds.has(tx.id)
        const isRevokeRow = tx.event_type.includes('revoked')
        const sourceCfg = getSourceConfig(tx.source)
        const SourceIcon = sourceCfg.icon

        const gratitudeArrow = tx.event_type === 'gratitude_gift_sent'
          ? 'sent'
          : tx.event_type === 'gratitude_recipient_points'
            ? 'received'
            : null

        return (
          <div
            key={idx}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
            data-onboarding={idx === 0 ? 'transactions-row-first' : undefined}
          >
            {showId && (
              <button
                type="button"
                title={`${tx.id} — нажмите для копирования`}
                onClick={() => handleCopyId(tx.id)}
                className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all cursor-pointer"
                style={{
                  background: copiedId === tx.id ? 'var(--apex-primary-bg)' : 'var(--apex-bg)',
                  border: `1px solid ${copiedId === tx.id ? 'var(--apex-primary)' : 'var(--apex-border)'}`,
                  color: copiedId === tx.id ? 'var(--apex-primary)' : 'var(--apex-text-muted)',
                }}
              >
                {copiedId === tx.id ? <Check size={10} /> : '#'}
              </button>
            )}
            <div className="relative flex-shrink-0">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-center text-lg leading-none"
                style={{ background: iconBg, border: iconBorder, overflow: 'hidden' }}
              >
                <span className="translate-x-[0.5px] inline-block">{iconContent}</span>
              </div>
              {gratitudeArrow && (
                <div
                  className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
                >
                  {gratitudeArrow === 'sent'
                    ? <ArrowUpRight size={10} style={{ color: 'var(--apex-text-muted)' }} />
                    : <ArrowDownLeft size={10} style={{ color: 'var(--apex-primary)' }} />
                  }
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 min-w-0 flex-wrap leading-none">
                {hasBonusTasks ? (
                  <button
                    type="button"
                    onClick={() => toggleExpanded(tx.id)}
                    className="text-[13px] font-semibold inline-flex items-center gap-1 hover:underline"
                    style={{ color: 'var(--apex-text)' }}
                  >
                    <span>{tx.description}</span>
                    {isExpanded
                      ? <ChevronUp size={12} style={{ color: 'var(--apex-text-muted)' }} />
                      : <ChevronDown size={12} style={{ color: 'var(--apex-text-muted)' }} />
                    }
                  </button>
                ) : (
                  <span className="text-[13px] font-semibold" style={{ color: 'var(--apex-text)' }}>
                    {tx.description}
                  </span>
                )}
                {tx.inlineLink && (
                  tx.inlineLink.url ? (
                    <a
                      href={tx.inlineLink.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[13px] font-semibold hover:underline inline-flex items-center gap-1 min-w-0"
                      style={{ color: 'var(--apex-primary)' }}
                    >
                      <span className="truncate">{tx.inlineLink.text}</span>
                      <ExternalLink size={10} className="flex-shrink-0" style={{ color: 'var(--apex-text-muted)' }} />
                    </a>
                  ) : (
                    <span className="text-[13px] font-semibold truncate" style={{ color: 'var(--apex-text)' }}>
                      {tx.inlineLink.text}
                    </span>
                  )
                )}
              </div>

              {hasBonusTasks && isExpanded && (
                <div className="mt-2 px-3 py-2 rounded-xl space-y-1" style={{ background: 'var(--apex-bg)', border: '1px solid var(--apex-border)' }}>
                  {tx.bonusTasks!.map((task, idx) => {
                    const linkColor = isRevokeRow ? 'var(--apex-danger)' : 'var(--apex-primary)'
                    const textColor = isRevokeRow ? 'var(--apex-danger)' : 'var(--apex-text)'
                    return (
                      <div key={task.id} className="flex items-start gap-2 text-[11px]">
                        <span className="shrink-0 w-5 text-right pt-0.5" style={{ color: 'var(--apex-text-muted)' }}>
                          {idx + 1}.
                        </span>
                        {isRevokeRow && (
                          <XCircle size={11} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--apex-danger)' }} />
                        )}
                        <div className="min-w-0 flex-1">
                          {task.url ? (
                            <a
                              href={task.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline inline-flex items-center gap-1 min-w-0"
                              style={{ color: linkColor }}
                            >
                              <span className={`truncate ${isRevokeRow ? 'line-through' : ''}`}>{task.name}</span>
                              <ExternalLink size={10} className="flex-shrink-0" />
                            </a>
                          ) : (
                            <span className={`truncate ${isRevokeRow ? 'line-through' : ''}`} style={{ color: textColor }}>{task.name}</span>
                          )}
                          {task.dateClosed && (
                            <div className="text-[10px]" style={{ color: 'var(--apex-text-muted)' }}>
                              закрыта: {formatTaskClosedAt(task.dateClosed)}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {tx.subItems && tx.subItems.length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {tx.subItems.map((item, i) => (
                    <div key={i} className="flex items-center gap-1 text-[11px]">
                      <span style={{ color: 'var(--apex-text-muted)' }}>•</span>
                      {item.url ? (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline flex items-center gap-1"
                          style={{ color: 'var(--apex-text-secondary)' }}
                        >
                          <span className="truncate">{item.text}</span>
                          <ExternalLink size={10} className="flex-shrink-0" style={{ color: 'var(--apex-text-muted)' }} />
                        </a>
                      ) : (
                        <span style={{ color: 'var(--apex-text-secondary)' }}>{item.text}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {tx.taskClosedAt && (
                <div className="mt-1 leading-none">
                  <span className="text-[11px]" style={{ color: 'var(--apex-text-muted)' }}>
                    задача закрыта: {formatTaskClosedAt(tx.taskClosedAt)}
                  </span>
                </div>
              )}

              {/* Тип + дата — только на мобильных */}
              <div className="flex items-center gap-2 mt-1.5 md:hidden flex-wrap">
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ background: sourceCfg.bg, color: sourceCfg.color }}
                >
                  <SourceIcon size={10} />
                  {sourceCfg.label}
                </span>
                <span className="text-[11px]" style={{ color: 'var(--apex-text-muted)' }}>
                  {tx.dateFormatted}
                </span>
              </div>
            </div>
            <div className="hidden md:flex w-32 flex-shrink-0">
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold"
                style={{ background: sourceCfg.bg, color: sourceCfg.color }}
              >
                <SourceIcon size={11} />
                {sourceCfg.label}
              </span>
            </div>
            <div
              className="hidden md:block w-24 flex-shrink-0 text-[13px] text-left"
              style={{ color: 'var(--apex-text-muted)' }}
            >
              {tx.dateFormatted}
            </div>
            <div
              className="w-20 md:w-24 flex-shrink-0 text-[14px] font-bold text-right md:text-left"
              style={{ color: amountColor }}
            >
              {`${tx.coins > 0 ? '+' : ''}${tx.coins.toLocaleString('ru-RU')}`}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function TransactionsListSkeleton() {
  return (
    <div className="space-y-1">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
          <div className="w-9 h-9 rounded-xl flex-shrink-0 animate-pulse" style={{ background: '#E5E7EB' }} />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-48 rounded animate-pulse" style={{ background: '#E5E7EB' }} />
            <div className="h-2.5 w-24 rounded animate-pulse" style={{ background: '#E5E7EB' }} />
          </div>
          <div className="hidden md:block w-32 flex-shrink-0">
            <div className="h-5 w-20 rounded-full animate-pulse" style={{ background: '#E5E7EB' }} />
          </div>
          <div className="hidden md:block w-24 flex-shrink-0">
            <div className="h-3 w-16 rounded animate-pulse" style={{ background: '#E5E7EB' }} />
          </div>
          <div className="w-24 flex-shrink-0 flex justify-start">
            <div className="h-3 w-12 rounded animate-pulse" style={{ background: '#E5E7EB' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function formatTaskClosedAt(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}.${m}.${y}`
}
