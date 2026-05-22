'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useTransition } from 'react'

import { CoinStatic } from '@/components/CoinBalance'
import type { DesignerFilter, LowBalanceUser } from '@/modules/admin'

interface LowBalanceSectionProps {
  users: LowBalanceUser[]
  designerFilter: DesignerFilter
  totalCount: number
}

const FILTER_OPTIONS: { value: DesignerFilter; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'designer', label: 'Проектировщики' },
  { value: 'non_designer', label: 'Непроектировщики' },
]

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1 rounded-full text-[12px] transition-all"
      style={{
        background: active ? 'var(--apex-success-bg)' : 'transparent',
        color: active ? 'var(--apex-primary)' : 'var(--apex-text-secondary)',
        border: `1px solid ${active ? 'var(--apex-primary)' : 'var(--apex-border)'}`,
        fontWeight: active ? 600 : 500,
      }}
    >
      {children}
    </button>
  )
}

export function LowBalanceSection({ users, designerFilter, totalCount }: LowBalanceSectionProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const handleFilter = (next: DesignerFilter) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('designerFilter', next)
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-[14px] font-bold" style={{ color: 'var(--apex-text)' }}>
            Группа риска
          </h2>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--apex-text-muted)' }}>
            Нижние 10% по балансу кристаллов — {totalCount} чел.
          </p>
        </div>
        <div className="flex gap-1">
          {FILTER_OPTIONS.map((opt) => (
            <FilterChip
              key={opt.value}
              active={designerFilter === opt.value}
              onClick={() => handleFilter(opt.value)}
            >
              {opt.label}
            </FilterChip>
          ))}
        </div>
      </div>

      <div
        className={`rounded-2xl overflow-hidden transition-opacity ${isPending ? 'opacity-60' : ''}`}
        style={{ border: '1px solid var(--apex-border)' }}
      >
        {users.length === 0 ? (
          <div
            className="px-5 py-8 text-center text-[13px]"
            style={{ color: 'var(--apex-text-muted)' }}
          >
            Нет данных по выбранному фильтру
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ background: 'var(--apex-surface-2, var(--apex-surface))' }}>
                <th
                  className="px-4 py-2.5 text-left font-medium"
                  style={{ color: 'var(--apex-text-secondary)' }}
                >
                  #
                </th>
                <th
                  className="px-4 py-2.5 text-left font-medium"
                  style={{ color: 'var(--apex-text-secondary)' }}
                >
                  Сотрудник
                </th>
                <th
                  className="px-4 py-2.5 text-left font-medium hidden sm:table-cell"
                  style={{ color: 'var(--apex-text-secondary)' }}
                >
                  Отдел
                </th>
                <th
                  className="px-4 py-2.5 text-left font-medium hidden md:table-cell"
                  style={{ color: 'var(--apex-text-secondary)' }}
                >
                  Команда
                </th>
                <th
                  className="px-4 py-2.5 text-right font-medium"
                  style={{ color: 'var(--apex-text-secondary)' }}
                >
                  Кристаллы
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, idx) => (
                <tr
                  key={user.id}
                  style={{
                    background: idx % 2 === 0 ? 'var(--apex-surface)' : 'transparent',
                    borderTop: '1px solid var(--apex-border)',
                  }}
                >
                  <td
                    className="px-4 py-2.5 tabular-nums"
                    style={{ color: 'var(--apex-text-muted)' }}
                  >
                    {idx + 1}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: 'var(--apex-text)' }}>
                    <span className="font-medium">
                      {user.last_name} {user.first_name}
                    </span>
                    {user.is_beta_tester && (
                      <span
                        className="ml-2 text-[11px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{
                          background: 'var(--apex-success-bg)',
                          color: 'var(--apex-primary)',
                        }}
                      >
                        beta
                      </span>
                    )}
                  </td>
                  <td
                    className="px-4 py-2.5 hidden sm:table-cell"
                    style={{ color: 'var(--apex-text-secondary)' }}
                  >
                    {user.department ?? '—'}
                  </td>
                  <td
                    className="px-4 py-2.5 hidden md:table-cell"
                    style={{ color: 'var(--apex-text-secondary)' }}
                  >
                    {user.team ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <CoinStatic amount={user.total_coins} size="sm" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
