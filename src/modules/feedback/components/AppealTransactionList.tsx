'use client'

import { useMemo } from 'react'
import { Briefcase, Building2, Heart, Trophy, Award, ShoppingBag, Tag, Check } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import type { AppealTransaction } from '@/modules/feedback/index.client'

interface AppealTransactionListProps {
  transactions: AppealTransaction[]
  selected: Set<string>
  onToggle: (id: string) => void
  // ID транзакций, которые уже покрыты выбранными днями (визуально диммируем)
  coveredByDates: Set<string>
  // Высота в px — чтобы блок совпадал по высоте с календарём слева
  height?: number
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
  return SOURCE_CONFIG[source] ?? { icon: Tag, label: source, bg: 'var(--tag-gray-bg)', color: 'var(--tag-gray-text)' }
}

// Правильные двухбуквенные сокращения — getDay(): 0=Вс, 1=Пн, ..., 6=Сб
const WEEKDAYS_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']

// WS-события хранятся с event_date = рабочий день + 1 (trg_fix_ws_event_date)
const DATE_MINUS_ONE_TYPES = new Set(['red_day', 'wrong_status_report'])

function displayDate(tx: AppealTransaction): string {
  const d = new Date(tx.event_date + 'T00:00:00')
  if (DATE_MINUS_ONE_TYPES.has(tx.event_type)) {
    d.setDate(d.getDate() - 1)
  }
  return `${d.getDate()} ${MONTHS[d.getMonth()]} (${WEEKDAYS_SHORT[d.getDay()]}.)`
}

function groupKey(tx: AppealTransaction): string {
  // Группа — реальная «пользовательская» дата (с учётом сдвига)
  const d = new Date(tx.event_date + 'T00:00:00')
  if (DATE_MINUS_ONE_TYPES.has(tx.event_type)) {
    d.setDate(d.getDate() - 1)
  }
  return d.toISOString().slice(0, 10)
}

interface Group {
  key: string
  label: string
  items: AppealTransaction[]
}

export function AppealTransactionList({ transactions, selected, onToggle, coveredByDates, height }: AppealTransactionListProps) {
  const groups = useMemo<Group[]>(() => {
    const byDate = new Map<string, AppealTransaction[]>()
    for (const tx of transactions) {
      const key = groupKey(tx)
      const list = byDate.get(key) ?? []
      list.push(tx)
      byDate.set(key, list)
    }
    return [...byDate.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, items]) => ({ key, label: displayDate(items[0]), items }))
  }, [transactions])

  if (transactions.length === 0) {
    return (
      <div
        className="rounded-xl flex items-center justify-center p-6 text-center text-xs"
        style={{
          background: 'var(--apex-bg)',
          border: '1px solid var(--apex-border)',
          color: 'var(--apex-text-muted)',
          height: height ?? 'auto',
          minHeight: 120,
        }}
      >
        Нет операций за последние 30 дней
      </div>
    )
  }

  return (
    <div
      className="rounded-xl overflow-y-auto scrollbar-hide"
      style={{
        background: 'var(--apex-bg)',
        border: '1px solid var(--apex-border)',
        height: height ?? 'auto',
        maxHeight: height ?? 220,
      }}
    >
      {groups.map((group) => (
        <div key={group.key}>
          <div
            className="sticky top-0 px-3 pt-1.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wider"
            style={{
              color: 'var(--apex-text-muted)',
              background: 'var(--apex-bg)',
              zIndex: 1,
            }}
          >
            {group.label}
          </div>
          <div className="px-1 pb-0.5 space-y-0">
            {group.items.map((tx) => {
              const isSelected = selected.has(tx.id)
              const isCovered = coveredByDates.has(tx.id)
              const srcCfg = getSourceConfig(tx.source)
              const SourceIcon = srcCfg.icon

              const isNegative = tx.coins < 0
              const isZero = tx.coins === 0
              const amountColor = isNegative
                ? 'var(--apex-danger)'
                : isZero
                  ? 'var(--apex-text-muted)'
                  : 'var(--apex-primary)'
              const iconBg = isNegative ? 'var(--apex-error-bg)' : 'var(--apex-bg)'
              const iconBorder = isNegative
                ? '1px solid rgba(var(--apex-danger-rgb), 0.12)'
                : '1px solid var(--apex-border)'

              return (
                <button
                  key={tx.id}
                  type="button"
                  onClick={() => onToggle(tx.id)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors"
                  style={{
                    background: isSelected ? 'var(--apex-primary-bg)' : 'transparent',
                    border: `1px solid ${isSelected ? 'var(--apex-primary)' : 'transparent'}`,
                    opacity: isCovered && !isSelected ? 0.45 : 1,
                  }}
                  title={isCovered && !isSelected ? 'Эта операция уже входит в выбранный день' : undefined}
                >
                  {/* Чекбокс */}
                  <span
                    className="w-4 h-4 rounded-sm flex items-center justify-center shrink-0"
                    style={{
                      background: isSelected ? 'var(--apex-primary)' : 'var(--apex-surface)',
                      border: `1px solid ${isSelected ? 'var(--apex-primary)' : 'var(--apex-border)'}`,
                    }}
                  >
                    {isSelected && <Check size={10} style={{ color: '#fff' }} strokeWidth={3} />}
                  </span>

                  {/* Иконка события */}
                  <span
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0"
                    style={{ background: iconBg, border: iconBorder }}
                  >
                    {tx.icon}
                  </span>

                  {/* Описание + source-бейдж */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium truncate" style={{ color: 'var(--apex-text)' }}>
                      {tx.description}
                    </div>
                    <div
                      className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold"
                      style={{ background: srcCfg.bg, color: srcCfg.color }}
                    >
                      <SourceIcon size={9} />
                      {srcCfg.label}
                    </div>
                  </div>

                  {/* Сумма */}
                  <span className="text-[12px] font-bold shrink-0" style={{ color: amountColor }}>
                    {tx.coins > 0 ? '+' : ''}{tx.coins.toLocaleString('ru-RU')}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
