import { ExternalLink } from 'lucide-react'

import type { TransactionSubItem } from '../types'

interface TransactionItem {
  id: string
  event_type: string
  source: string
  coins: number
  description: string
  icon: string
  dateFormatted: string
  subItems?: TransactionSubItem[]
  productEmoji?: string
  productImageUrl?: string | null
}

interface TransactionsListProps {
  items: TransactionItem[]
}

const SOURCE_LABELS: Record<string, string> = {
  ws: 'Worksection',
  revit: 'Revit',
  airtable: 'Благодарности',
  contest: 'Соревнование',
}

export function TransactionsList({ items }: TransactionsListProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-[13px]" style={{ color: 'var(--apex-text-muted)' }}>
        Нет операций
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {items.map((tx) => {
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

        return (
          <div key={tx.id} className="flex items-start gap-3 px-3 py-2.5 rounded-xl">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0 mt-0.5"
              style={{
                background: iconBg,
                border: iconBorder,
                overflow: 'hidden',
              }}
            >
              {iconContent}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold truncate" style={{ color: 'var(--apex-text)' }}>
                {tx.description}
              </div>

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

              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px]" style={{ color: 'var(--apex-text-muted)' }}>
                  {tx.dateFormatted}
                </span>
                <span
                  className="px-1.5 py-0.5 rounded text-[9px] font-medium"
                  style={{ background: 'var(--apex-bg)', color: 'var(--apex-text-muted)', border: '1px solid var(--apex-border)' }}
                >
                  {SOURCE_LABELS[tx.source] ?? tx.source}
                </span>
              </div>
            </div>
            <div className="text-[14px] font-bold flex-shrink-0 mt-0.5" style={{ color: amountColor }}>
              {isZero ? '—' : `${tx.coins > 0 ? '+' : ''}${tx.coins.toLocaleString('ru-RU')}`}
            </div>
          </div>
        )
      })}
    </div>
  )
}
