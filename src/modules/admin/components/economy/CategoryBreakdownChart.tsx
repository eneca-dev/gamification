'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

import { CoinStatic } from '@/components/CoinBalance'
import type { CategoryRow, CategoryProduct } from '@/modules/admin'

interface CategoryBreakdownChartProps {
  categories: CategoryRow[]
}

const PALETTE = [
  '#1B6B58',
  '#3FA887',
  '#2563EB',
  '#D97706',
  '#8B5CF6',
  '#DC2626',
  '#0EA5E9',
  '#F59E0B',
  '#10B981',
  '#EC4899',
  '#64748B',
]

export function CategoryBreakdownChart({ categories }: CategoryBreakdownChartProps) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)

  if (categories.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="text-[14px] font-bold" style={{ color: 'var(--apex-text)' }}>
          Категории магазина
        </h2>
        <div
          className="rounded-2xl p-6 text-center text-[12px]"
          style={{
            background: 'var(--apex-surface)',
            border: '1px solid var(--apex-border)',
            color: 'var(--apex-text-muted)',
          }}
        >
          Нет покупок за период
        </div>
      </section>
    )
  }

  const total = categories.reduce((sum, c) => sum + c.coins, 0)
  const data = categories.map((c, i) => ({
    id: c.category_id,
    name: c.category_name,
    value: c.coins,
    color: PALETTE[i % PALETTE.length],
  }))

  const handleToggle = (id: string) => {
    setExpanded(expanded === id ? null : id)
  }

  return (
    <section className="space-y-3">
      <h2 className="text-[14px] font-bold" style={{ color: 'var(--apex-text)' }}>
        Категории магазина
      </h2>
      <div
        className="rounded-2xl p-4 grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-6 items-center"
        style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
      >
        <div className="w-full h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={1}
                stroke="var(--apex-surface)"
                strokeWidth={2}
                onClick={(slice: { id?: string }) => {
                  if (slice.id) handleToggle(slice.id)
                }}
                onMouseEnter={(slice: { id?: string }) => {
                  if (slice.id) setHovered(slice.id)
                }}
                onMouseLeave={() => setHovered(null)}
              >
                {data.map((entry) => (
                  <Cell
                    key={entry.id}
                    fill={entry.color}
                    fillOpacity={
                      hovered === null || hovered === entry.id || expanded === entry.id ? 1 : 0.4
                    }
                    style={{ cursor: 'pointer', transition: 'fill-opacity 150ms' }}
                  />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null
                  const item = payload[0].payload as { name: string; value: number; color: string }
                  const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0'
                  return (
                    <div
                      className="rounded-lg px-3 py-2 text-[12px]"
                      style={{
                        background: 'var(--apex-surface)',
                        border: '1px solid var(--apex-border)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                      }}
                    >
                      <div className="flex items-center gap-2 font-semibold" style={{ color: 'var(--apex-text)' }}>
                        <span className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                        {item.name}
                      </div>
                      <div className="mt-1" style={{ color: 'var(--apex-text-muted)' }}>
                        {item.value.toLocaleString('ru-RU')} 💎 · {pct}%
                      </div>
                    </div>
                  )
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="flex flex-col">
          {categories.map((category, idx) => (
            <CategoryItem
              key={category.category_id}
              category={category}
              total={total}
              color={PALETTE[idx % PALETTE.length]}
              isExpanded={expanded === category.category_id}
              isDimmed={hovered !== null && hovered !== category.category_id}
              onToggle={() => handleToggle(category.category_id)}
              onHoverChange={(active) => setHovered(active ? category.category_id : null)}
              isLast={idx === categories.length - 1}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

interface CategoryItemProps {
  category: CategoryRow
  total: number
  color: string
  isExpanded: boolean
  isDimmed: boolean
  onToggle: () => void
  onHoverChange: (active: boolean) => void
  isLast: boolean
}

function CategoryItem({
  category,
  total,
  color,
  isExpanded,
  isDimmed,
  onToggle,
  onHoverChange,
  isLast,
}: CategoryItemProps) {
  const pct = total > 0 ? ((category.coins / total) * 100).toFixed(1) : '0'

  return (
    <div
      className="transition-opacity"
      style={{
        borderBottom: isLast ? 'none' : '1px solid var(--apex-border)',
        opacity: isDimmed ? 0.5 : 1,
      }}
    >
      <button
        onClick={onToggle}
        onMouseEnter={() => onHoverChange(true)}
        onMouseLeave={() => onHoverChange(false)}
        className="w-full px-2 py-2.5 flex items-center gap-3 text-left rounded-lg transition-colors hover:bg-[var(--apex-bg)]"
      >
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
        <ChevronDown
          size={12}
          className="shrink-0 transition-transform"
          style={{
            color: 'var(--apex-text-muted)',
            transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
          }}
        />
        <span
          className="flex-1 text-[13px] font-semibold truncate"
          style={{ color: 'var(--apex-text)' }}
        >
          {category.category_name}
        </span>
        <span
          className="text-[11px] tabular-nums shrink-0"
          style={{ color: 'var(--apex-text-muted)' }}
        >
          {pct}%
        </span>
        <span
          className="text-[11px] tabular-nums shrink-0"
          style={{ color: 'var(--apex-text-muted)' }}
        >
          {category.orders} {pluralizeOrders(category.orders)}
        </span>
        <span className="shrink-0" style={{ color: 'var(--apex-text)' }}>
          <CoinStatic amount={category.coins} size="sm" />
        </span>
      </button>

      {isExpanded && (
        <div
          className="px-3 pb-2 rounded-lg"
          style={{ background: 'var(--apex-bg)' }}
        >
          {category.products.length === 0 ? (
            <div
              className="text-[12px] py-3 text-center"
              style={{ color: 'var(--apex-text-muted)' }}
            >
              Нет товаров
            </div>
          ) : (
            <ul className="flex flex-col">
              {category.products.map((product) => (
                <ProductRow key={product.id} product={product} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

interface ProductRowProps {
  product: CategoryProduct
}

function ProductRow({ product }: ProductRowProps) {
  return (
    <li
      className="flex items-center gap-3 py-2"
      style={{ borderBottom: '1px solid var(--apex-border)' }}
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 overflow-hidden"
        style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
      >
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image_url} alt="" className="w-full h-full object-cover" />
        ) : product.emoji ? (
          <span className="text-[14px]">{product.emoji}</span>
        ) : (
          <span className="text-[10px]" style={{ color: 'var(--apex-text-muted)' }}>?</span>
        )}
      </div>
      <span
        className="flex-1 text-[12px] truncate"
        style={{ color: 'var(--apex-text)' }}
      >
        {product.name}
      </span>
      <span
        className="text-[11px] tabular-nums shrink-0"
        style={{ color: 'var(--apex-text-muted)' }}
      >
        {product.orders} {pluralizeOrders(product.orders)}
      </span>
      <span className="shrink-0" style={{ color: 'var(--apex-text)' }}>
        <CoinStatic amount={product.coins} size="sm" />
      </span>
    </li>
  )
}

function pluralizeOrders(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod100 >= 11 && mod100 <= 14) return 'покупок'
  if (mod10 === 1) return 'покупка'
  if (mod10 >= 2 && mod10 <= 4) return 'покупки'
  return 'покупок'
}
