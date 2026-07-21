import type { ReactNode } from 'react'

import { CoinStatic } from '@/components/CoinBalance'

import type { AdoptionSideEffectsData } from '@/modules/admin'

import { InfoTooltip } from './InfoTooltip'

interface Props {
  data: AdoptionSideEffectsData
}

interface StatCardProps {
  label: string
  value: ReactNode
  hint: string
  tooltip?: ReactNode
}

function StatCard({ label, value, hint, tooltip }: StatCardProps) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-2"
      style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
    >
      <span className="flex items-center gap-1 text-[12px] font-medium" style={{ color: 'var(--apex-text-secondary)' }}>
        {label}
        {tooltip}
      </span>
      <span className="text-[24px] font-bold tabular-nums leading-tight" style={{ color: 'var(--apex-text)' }}>
        {value}
      </span>
      <span className="text-[11px]" style={{ color: 'var(--apex-text-muted)' }}>
        {hint}
      </span>
    </div>
  )
}

export function SideEffectsSection({ data }: Props) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-[14px] font-bold" style={{ color: 'var(--apex-text)' }}>
          Активность выборки в системе (с 1 июля 2026)
        </h2>
        <p className="text-[12px]" style={{ color: 'var(--apex-text-secondary)' }}>
          Кристаллы, благодарности, магазин и чат-бот — насколько активно выборка пользуется самой системой геймификации.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard
          label="Зарабатывают кристаллы"
          value={`${data.earners_count} чел.`}
          hint={`${data.earners_pct}% выборки получили хотя бы одно начисление`}
          tooltip={
            <InfoTooltip
              desc="Сколько сотрудников реально вовлечены в заработок кристаллов, а не только зарегистрированы."
              formula="COUNT уникальных с начислением > 0"
            />
          }
        />
        <StatCard
          label="Кристаллов на балансах"
          value={<CoinStatic amount={data.balance_total} size="xl" />}
          hint={`в среднем ${data.balance_avg.toLocaleString('ru-RU')} на зарабатывающего`}
          tooltip={
            <InfoTooltip
              desc="Текущая сумма балансов выборки — накоплено и ещё не потрачено. Включает 18 000 кристаллов, выданных пилотной группе в апреле (12 чел. × 1500) вне обычных начислений."
              formula="Σ балансов выборки"
            />
          }
        />
        <StatCard
          label="Потрачено кристаллов"
          value={<CoinStatic amount={data.spent_total} size="xl" />}
          hint="заказы в магазине и другие траты"
          tooltip={
            <InfoTooltip
              desc="Сумма всех списаний кристаллов выборкой с 1 июля — показывает, тратятся кристаллы или накапливаются."
              formula="−Σ транзакций < 0, с 01.07"
            />
          }
        />
        <StatCard
          label="Благодарности"
          value={data.gratitude_total.toLocaleString('ru-RU')}
          hint={`отправляли ${data.gratitude_senders} чел. · получали ${data.gratitude_recipients} чел.`}
          tooltip={
            <InfoTooltip
              desc="Сколько благодарностей отправили сотрудники выборки (получатель может быть вне выборки)."
              formula="COUNT(благодарностей, отправитель ∈ выборке)"
            />
          }
        />
        <StatCard
          label="Заказы в магазине"
          value={data.shop_orders_total.toLocaleString('ru-RU')}
          hint={`${data.shop_orders_unique_users} покупателей`}
          tooltip={
            <InfoTooltip
              desc="Оформленные заказы сотрудников выборки, кроме отменённых."
              formula="COUNT(заказов ≠ отменён, покупатель ∈ выборке)"
            />
          }
        />
        <StatCard
          label="Сообщения чат-боту"
          value={data.chatbot_messages_total.toLocaleString('ru-RU')}
          hint={`${data.chatbot_unique_users} уникальных пользователей`}
          tooltip={
            <InfoTooltip
              desc="Сообщения от сотрудников выборки чат-боту (только реплики пользователя, не ответы бота)."
              formula="COUNT(сообщений role=user, автор ∈ выборке)"
            />
          }
        />
      </div>
    </section>
  )
}
