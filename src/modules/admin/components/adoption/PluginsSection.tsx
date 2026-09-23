'use client'

import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
  CartesianGrid, Label, Legend,
} from 'recharts'

import { EffectCard } from './EffectCard'
import { InfoTooltip, Fraction } from './InfoTooltip'

import type { AdoptionPluginsData } from '@/modules/admin'

const LAUNCH_DAY = '2026-07-01'

const LINE_LABELS: Record<string, string> = {
  users: 'Активных пользователей',
  launches: 'Запусков',
}

function formatDayLabel(day: string): string {
  const [, m, d] = day.split('-')
  return `${d}.${m}`
}

interface Props {
  data: AdoptionPluginsData
}

// Карточка роста «июнь → с 1 июля» с относительной дельтой в процентах
interface GrowthCardProps {
  label: string
  before: number
  after: number
  unit?: string
  hint: string
  tooltip?: React.ReactNode
}

function GrowthCard({ label, before, after, unit = '', hint, tooltip }: GrowthCardProps) {
  const growthPct = before > 0 ? Math.round(((after - before) / before) * 100) : 0
  const color = growthPct > 0 ? 'var(--apex-primary)' : growthPct < 0 ? 'var(--apex-danger)' : 'var(--apex-text-muted)'

  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-2"
      style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
    >
      <span className="flex items-center gap-1 text-[12px] font-medium" style={{ color: 'var(--apex-text-secondary)' }}>
        {label}
        {tooltip}
      </span>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-[22px] font-bold tabular-nums" style={{ color: 'var(--apex-text)' }}>
          <span className="text-[11px] font-medium mr-1" style={{ color: 'var(--apex-text-muted)' }}>БАЗА</span>
          {before}{unit}
          {' → '}
          <span className="text-[11px] font-medium mr-1" style={{ color: 'var(--apex-text-muted)' }}>ПЕРИОД</span>
          {after}{unit}
        </span>
        <span className="text-[14px] font-bold tabular-nums" style={{ color }}>
          {growthPct > 0 ? '+' : ''}{growthPct}%
        </span>
      </div>
      <span className="text-[11px]" style={{ color: 'var(--apex-text-muted)' }}>
        {hint}
      </span>
    </div>
  )
}

// Карточка с одиночным значением (не «до → после») — например, приток новых пользователей
function StatCard({
  label,
  value,
  hint,
  tooltip,
}: {
  label: string
  value: string
  hint: string
  tooltip?: React.ReactNode
}) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-2"
      style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
    >
      <span className="flex items-center gap-1 text-[12px] font-medium" style={{ color: 'var(--apex-text-secondary)' }}>
        {label}
        {tooltip}
      </span>
      <span className="text-[22px] font-bold tabular-nums" style={{ color: 'var(--apex-text)' }}>
        {value}
      </span>
      <span className="text-[11px]" style={{ color: 'var(--apex-text-muted)' }}>
        {hint}
      </span>
    </div>
  )
}

export function PluginsSection({ data }: Props) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-[14px] font-bold" style={{ color: 'var(--apex-text)' }}>
          Revit-плагины: активность за выбранный период
        </h2>
        <p className="text-[12px]" style={{ color: 'var(--apex-text-secondary)' }}>
          Сравнение выбранного периода с июнем — стабильной месячной базой до запуска.
          Только рабочие дни, только выборка проектировщиков. Первые две метрики нормированы
          на рабочий день, поэтому окна разной длины сопоставимы; третья — приток новых
          пользователей относительно июня.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <GrowthCard
          label="Активных в средний рабочий день"
          before={data.daily_active_before}
          after={data.daily_active_after}
          hint="уникальных пользователей плагинов за рабочий день"
          tooltip={
            <InfoTooltip
              desc="Ключевой показатель блока: сколько сотрудников в среднем пользуются плагинами в течение рабочего дня. Июнь — база до запуска, второе значение — выбранный период."
              formula="среднее уникальных за рабочий день"
            />
          }
        />
        <GrowthCard
          label="Запусков за рабочий день"
          before={data.launches_day_before}
          after={data.launches_day_after}
          hint="суммарных запусков плагинов выборкой за рабочий день"
          tooltip={
            <InfoTooltip
              desc="Общее число запусков плагинов за рабочий день — учитывает и число пользователей, и частоту запусков."
              formula="среднее Σ запусков за рабочий день"
            />
          }
        />
        <StatCard
          label="Новых пользователей плагинов"
          value={`${data.new_users_after} чел.`}
          hint="не пользовались плагинами в июне, но работали в выбранном периоде"
          tooltip={
            <InfoTooltip
              desc="Приток новых пользователей: проектировщики, которые в июне плагинами не пользовались, но запускали их в выбранном диапазоне."
              formula="уникальные за период, кроме активных в июне"
            />
          }
        />
      </div>

      <div
        className="rounded-2xl p-4 space-y-3"
        style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
      >
        <h3 className="text-[13px] font-semibold" style={{ color: 'var(--apex-text)' }}>
          Активность по дням: пользователи и запуски
        </h3>
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.daily} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--apex-border)" vertical={false} />
              <XAxis
                dataKey="day"
                tickFormatter={formatDayLabel}
                tick={{ fontSize: 11, fill: 'var(--apex-text-muted)' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={28}
              />
              <YAxis
                yAxisId="users"
                domain={[0, 'auto']}
                tick={{ fontSize: 11, fill: 'var(--apex-primary)' }}
                tickLine={false}
                axisLine={false}
                width={38}
              />
              <YAxis
                yAxisId="launches"
                orientation="right"
                domain={[0, 'auto']}
                tick={{ fontSize: 11, fill: 'var(--apex-info-text)' }}
                tickLine={false}
                axisLine={false}
                width={42}
              />
              <Tooltip
                formatter={(val: number | undefined, name: string | undefined) => [
                  val ?? '—',
                  LINE_LABELS[name ?? ''] ?? name,
                ]}
                labelFormatter={(label: unknown) => formatDayLabel(String(label))}
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid var(--apex-border)',
                  fontSize: 12,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                }}
              />
              <Legend
                formatter={(value: string) => LINE_LABELS[value] ?? value}
                wrapperStyle={{ fontSize: 11 }}
              />
              <ReferenceLine x={LAUNCH_DAY} yAxisId="users" stroke="var(--apex-warning-text)" strokeDasharray="4 3">
                <Label value="1 июля" position="insideTopRight" style={{ fontSize: 10, fill: 'var(--apex-warning-text)' }} />
              </ReferenceLine>
              <Line
                yAxisId="users"
                type="monotone"
                dataKey="users"
                stroke="var(--apex-primary)"
                strokeWidth={2}
                dot={{ r: 3, strokeWidth: 0, fill: 'var(--apex-primary)' }}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
              <Line
                yAxisId="launches"
                type="monotone"
                dataKey="launches"
                stroke="var(--apex-info-text)"
                strokeWidth={2}
                dot={{ r: 3, strokeWidth: 0, fill: 'var(--apex-info-text)' }}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[11px]" style={{ color: 'var(--apex-text-muted)' }}>
          Только рабочие дни выбранного диапазона. Левая ось — активные пользователи,
          правая — запуски. Средняя недельная аудитория внутри фильтра — около
          {` ${data.weekly_audience}`} человек.
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="text-[13px] font-semibold" style={{ color: 'var(--apex-text)' }}>
          Использование плагинов вошедшими и не вошедшими в геймификацию
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <EffectCard
            title="Вошли в приложение"
            before={data.effect_logged.active_before}
            after={data.effect_logged.active_after}
            hint={`июнь → выбранный период · ${data.effect_logged.users} чел.`}
            accent
            tooltip={
              <InfoTooltip
                desc="Группа авторизовавшихся определяется на конец выбранного периода. Нормировка на число рабочих дней делает периоды сопоставимыми."
                formula={<><Fraction num="Σ активных за день" den="дней × размер группы" /> × 100</>}
              />
            }
          />
          <EffectCard
            title="Не вошли (контрольная группа)"
            before={data.effect_not_logged.active_before}
            after={data.effect_not_logged.active_after}
            hint={`июнь → выбранный период · ${data.effect_not_logged.users} чел.`}
            accent={false}
            tooltip={
              <InfoTooltip
                desc="Не имели профиля на конец выбранного периода; плагины при этом доступны им на тех же условиях."
                formula={<><Fraction num="Σ активных за день" den="дней × размер группы" /> × 100</>}
              />
            }
          />
        </div>
        <p className="text-[11px]" style={{ color: 'var(--apex-text-muted)' }}>
          Состав групп определяется на дату окончания фильтра. Базой остаётся июнь,
          а второе значение полностью пересчитывается по выбранному диапазону.
        </p>
      </div>
    </section>
  )
}
