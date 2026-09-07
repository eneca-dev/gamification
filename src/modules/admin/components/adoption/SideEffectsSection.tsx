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
              formula="число людей с хотя бы одним начислением"
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
              formula="сумма балансов всех сотрудников выборки"
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
              formula="сумма всех списаний кристаллов с 1 июля"
            />
          }
        />
        <StatCard
          label="Благодарности"
          value={`${data.gratitude_senders_pct}%`}
          hint={`${data.gratitude_senders} из выборки отправили ${data.gratitude_total.toLocaleString('ru-RU')} благодарностей · получили ${data.gratitude_recipients} чел.`}
          tooltip={
            <InfoTooltip
              desc="Доля сотрудников выборки, отправивших хотя бы одну благодарность. Получатель может быть вне выборки."
              formula="уникальные отправители благодарностей / активные сотрудники выборки × 100"
            />
          }
        />
        <StatCard
          label="Покупки в магазине"
          value={`${data.shop_orders_unique_users_pct}%`}
          hint={`${data.shop_orders_unique_users} из выборки купили ${data.shop_orders_total.toLocaleString('ru-RU')} реальных наград`}
          tooltip={
            <InfoTooltip
              desc="Доля сотрудников выборки, купивших хотя бы одну реальную награду. «Вторая жизнь» и отменённые заказы не учитываются."
              formula="уникальные покупатели реальных товаров / активные сотрудники выборки × 100"
            />
          }
        />
        <StatCard
          label="«Вторая жизнь»"
          value={`${data.second_life_users_pct}%`}
          hint={`${data.second_life_users} из выборки использовали «Вторую жизнь» ${data.second_life_total.toLocaleString('ru-RU')} раз`}
          tooltip={
            <InfoTooltip
              desc="Доля сотрудников выборки, применивших хотя бы одну «Вторую жизнь» для защиты стрика. Учитываются и бесплатные квоты."
              formula="уникальные пользователи «Второй жизни» / активные сотрудники выборки × 100"
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
              formula="число сообщений выборки боту"
            />
          }
        />
        <StatCard
          label="Держат стрик по Worksection"
          value={`${data.ws_streak_holders} чел.`}
          hint={`из них ${data.ws_streak_7plus} — серия 7+ дней подряд`}
          tooltip={
            <InfoTooltip
              desc="Стрик — серия рабочих дней подряд без нарушений правил WS. Ключевая метрика привычки: чем больше людей держат серию, тем прочнее дисциплина вошла в рутину."
              formula="у скольких серия без нарушений сейчас не прервана"
            />
          }
        />
        <StatCard
          label="Держат стрик по Revit"
          value={`${data.revit_streak_holders} чел.`}
          hint={`из них ${data.revit_streak_7plus} — серия 7+ дней подряд`}
          tooltip={
            <InfoTooltip
              desc="Серия рабочих дней подряд с запуском плагинов. Показывает, у скольких работа в плагинах стала ежедневной привычкой."
              formula="у скольких серия с плагинами сейчас не прервана"
            />
          }
        />
      </div>
    </section>
  )
}
