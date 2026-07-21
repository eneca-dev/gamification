'use client'

import { useState } from 'react'

import { ChevronDown } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
  CartesianGrid, Label, Legend,
} from 'recharts'

import { EffectCard } from './EffectCard'
import { InfoTooltip, Fraction } from './InfoTooltip'

import type { AdoptionWorksectionData, AdoptionRedUser } from '@/modules/admin'

const LAUNCH_DAY = '2026-07-01'

const LINE_LABELS: Record<string, string> = {
  green_pct: '«Зелёные» дни',
  wrong_task_pct: 'Отчёт в задачу в статусе не «В работе»',
  no_report_pct: 'Нет отчёта',
}

interface Props {
  data: AdoptionWorksectionData
}

function formatDayLabel(day: string): string {
  const [, m, d] = day.split('-')
  return `${d}.${m}`
}

function formatDelta(delta: number, unit = ' пп'): string {
  const sign = delta > 0 ? '+' : ''
  return `${sign}${Math.round(delta * 10) / 10}${unit}`
}

const tooltipStyle = {
  borderRadius: 8,
  border: '1px solid var(--apex-border)',
  fontSize: 12,
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
}

// Карточка «ДО → ПОСЛЕ» с изменением; higherIsBetter управляет цветом дельты
interface CompareCardProps {
  label: string
  before: number
  after: number
  unit?: string
  hint: string
  higherIsBetter?: boolean
  tooltip?: React.ReactNode
}

function CompareCard({ label, before, after, unit = '%', hint, higherIsBetter = true, tooltip }: CompareCardProps) {
  const delta = Math.round((after - before) * 10) / 10
  const good = higherIsBetter ? delta > 0 : delta < 0
  const deltaColor = delta === 0
    ? 'var(--apex-text-muted)'
    : good ? 'var(--apex-primary)' : 'var(--apex-danger)'

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
          <span className="text-[11px] font-medium mr-1" style={{ color: 'var(--apex-text-muted)' }}>ДО</span>
          {before}{unit}
          {' → '}
          <span className="text-[11px] font-medium mr-1" style={{ color: 'var(--apex-text-muted)' }}>ПОСЛЕ</span>
          {after}{unit}
        </span>
        <span className="text-[14px] font-bold tabular-nums" style={{ color: deltaColor }}>
          {formatDelta(delta, unit === '%' ? ' пп' : '')}
        </span>
      </div>
      <span className="text-[11px]" style={{ color: 'var(--apex-text-muted)' }}>
        {hint}
      </span>
    </div>
  )
}

// Скрытый список нарушителей по одной причине: скролл внутри, сортировка по дням
function RedUsersList({ title, users }: { title: string; users: AdoptionRedUser[] }) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-2"
      style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12px] font-semibold" style={{ color: 'var(--apex-text)' }}>
          {title}
        </span>
        <span className="text-[11px]" style={{ color: 'var(--apex-text-muted)' }}>
          {users.length} чел.
        </span>
      </div>
      <div className="max-h-[260px] overflow-y-auto pr-1">
        <ul className="space-y-1">
          {users.map((u) => (
            <li
              key={`${u.name}-${u.department ?? ''}`}
              className="flex items-center justify-between gap-2 rounded-lg px-2 py-1"
              style={{ background: 'var(--apex-bg)' }}
            >
              <span className="min-w-0">
                <span className="block text-[12px] truncate" style={{ color: 'var(--apex-text)' }}>
                  {u.name}
                </span>
                {u.department && (
                  <span className="block text-[10px] truncate" style={{ color: 'var(--apex-text-muted)' }}>
                    {u.department}
                  </span>
                )}
              </span>
              <span className="text-[12px] font-semibold tabular-nums shrink-0" style={{ color: 'var(--apex-danger)' }}>
                {u.days} дн.
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export function WorksectionSection({ data }: Props) {
  const [showLists, setShowLists] = useState(false)

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-[14px] font-bold" style={{ color: 'var(--apex-text)' }}>
          Дисциплина Worksection: ДО и ПОСЛЕ
        </h2>
        <p className="text-[12px]" style={{ color: 'var(--apex-text-secondary)' }}>
          Итоговый вердикт («зелёный» день) и два главных нарушения на одних и тех же рабочих днях.
          Нарушения показаны долей от отслеживаемых — чем меньше, тем лучше.
          ДО = 29–30 июня, ПОСЛЕ = с 1 июля.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <CompareCard
          label="«Зелёные» дни"
          before={data.green_before}
          after={data.green_after}
          hint="доля рабочих дней без нарушений правил WS"
          tooltip={
            <InfoTooltip
              desc="Главный показатель дисциплины. Знаменатель — только рабочие дни с вердиктом; отсутствия (отпуск, больничный) не считаются."
              formula={<Fraction num="Σ зелёных" den="Σ отслеживаемых" />}
            />
          }
        />
        <CompareCard
          label="Отчёт в задачу в статусе не «В работе»"
          before={data.wrong_task_before}
          after={data.wrong_task_after}
          higherIsBetter={false}
          hint={`в среднем ${data.wrong_task_day_before} → ${data.wrong_task_day_after} случаев за рабочий день`}
          tooltip={
            <InfoTooltip
              desc="Наиболее частое нарушение; именно его снижение обеспечило основной рост зелёных дней. Часы списаны в задачу, которая на дату списания не была в статусе «В работе» (правило 4 WS)."
              formula={<Fraction num="Σ с этим нарушением" den="Σ отслеживаемых" />}
            />
          }
        />
        <CompareCard
          label="Нет отчёта"
          before={data.no_report_before}
          after={data.no_report_after}
          higherIsBetter={false}
          hint={`в среднем ${data.no_report_day_before} → ${data.no_report_day_after} случаев за рабочий день`}
          tooltip={
            <InfoTooltip
              desc="Отчёт = хотя бы одно списание часов за день. Засчитывается только в тот же день — внесённый позже считается несданным."
              formula={<Fraction num="Σ не сдавших отчёт" den="Σ отслеживаемых" />}
            />
          }
        />
      </div>

      <div className="space-y-3">
        <button
          onClick={() => setShowLists((v) => !v)}
          className="flex items-center gap-1.5 text-[12px] font-medium transition-colors"
          style={{ color: 'var(--apex-text-secondary)' }}
        >
          <ChevronDown
            size={14}
            className={`transition-transform ${showLists ? 'rotate-180' : ''}`}
          />
          {showLists ? 'Скрыть списки нарушителей' : 'Показать списки нарушителей (с 1 июля)'}
        </button>
        {showLists && (
          <div className="space-y-2">
            <p className="text-[11px]" style={{ color: 'var(--apex-text-muted)' }}>
              Справа у каждого — сколько рабочих дней с 1 июля закончились этим нарушением.
              Без сотрудников в декрете: Worksection почти никогда не фиксирует для них
              отпуск по уходу, поэтому их не за что включать в нарушителей.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <RedUsersList
                title="Нет отчёта"
                users={data.no_report_users}
              />
              <RedUsersList
                title="Отчёт в задачу в статусе не «В работе»"
                users={data.wrong_task_users}
              />
            </div>
          </div>
        )}
      </div>

      <div
        className="rounded-2xl p-4 space-y-3"
        style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
      >
        <h3 className="text-[13px] font-semibold" style={{ color: 'var(--apex-text)' }}>
          «Зелёные» дни и нарушения по дням
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
                interval={0}
              />
              <YAxis
                domain={[
                  (dataMin: number) => Math.max(0, Math.floor((dataMin - 5) / 10) * 10),
                  (dataMax: number) => Math.min(100, Math.ceil((dataMax + 5) / 10) * 10),
                ]}
                tickFormatter={(v: number) => `${v}%`}
                tick={{ fontSize: 11, fill: 'var(--apex-text-muted)' }}
                tickLine={false}
                axisLine={false}
                width={38}
              />
              <Tooltip
                formatter={(val: number | undefined, name: string | undefined) => [
                  val !== undefined && val !== null ? `${val}%` : '—',
                  LINE_LABELS[name ?? ''] ?? name,
                ]}
                labelFormatter={(label: unknown) => formatDayLabel(String(label))}
                contentStyle={tooltipStyle}
              />
              <Legend
                formatter={(value: string) => LINE_LABELS[value] ?? value}
                wrapperStyle={{ fontSize: 11 }}
              />
              <ReferenceLine x={LAUNCH_DAY} stroke="var(--apex-warning-text)" strokeDasharray="4 3">
                <Label value="1 июля" position="insideTopRight" style={{ fontSize: 10, fill: 'var(--apex-warning-text)' }} />
              </ReferenceLine>
              <Line
                type="monotone"
                dataKey="green_pct"
                stroke="var(--apex-primary)"
                strokeWidth={2}
                dot={{ r: 3, strokeWidth: 0, fill: 'var(--apex-primary)' }}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
              <Line
                type="monotone"
                dataKey="wrong_task_pct"
                stroke="var(--apex-danger)"
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={{ r: 3, strokeWidth: 0, fill: 'var(--apex-danger)' }}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
              <Line
                type="monotone"
                dataKey="no_report_pct"
                stroke="var(--apex-warning-text)"
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={{ r: 3, strokeWidth: 0, fill: 'var(--apex-warning-text)' }}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[11px]" style={{ color: 'var(--apex-text-muted)' }}>
          Только рабочие дни (3 июля — праздник, поэтому дня нет). Пунктирные линии —
          нарушения: чем ниже, тем лучше. «Зелёные» дни растут в основном за счёт снижения
          отчётов в задачи в статусе не «В работе» — доля несданных отчётов почти не изменилась.
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="text-[13px] font-semibold" style={{ color: 'var(--apex-text)' }}>
          Эффект вовлечения: геймификация работает на тех, кто в неё вошёл
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <EffectCard
            title="Вошли в приложение"
            before={data.logged.green_before}
            after={data.logged.green_after}
            hint={`доля «зелёных» дней до и после запуска · ${data.logged.users} чел.`}
            accent
            tooltip={
              <InfoTooltip
                desc="Дисциплина этой группы заметно выросла после запуска. Группа определяется по факту входа в приложение (наличие профиля)."
                formula={<Fraction num="Σ зелёных в группе" den="Σ отслеживаемых" />}
              />
            }
          />
          <EffectCard
            title="Не вошли (контрольная группа)"
            before={data.not_logged.green_before}
            after={data.not_logged.green_after}
            hint={`доля «зелёных» дней до и после запуска · ${data.not_logged.users} чел.`}
            accent={false}
            tooltip={
              <InfoTooltip
                desc="Контрольная группа: правила WS для них те же, но роста нет. Значит рост у вошедших связан именно с запуском геймификации, а не с сезонностью."
                formula={<Fraction num="Σ зелёных в группе" den="Σ отслеживаемых" />}
              />
            }
          />
        </div>
        <p className="text-[11px]" style={{ color: 'var(--apex-text-muted)' }}>
          Правила Worksection одинаковы для всех сотрудников, но дисциплина выросла только у вошедших
          в приложение — у остальных осталась на прежнем уровне. Не вошедшие служат контрольной группой:
          если бы рост объяснялся сезонностью или другими общими причинами, он проявился бы в обеих
          группах. Это указывает на вклад именно геймификации.
        </p>
      </div>
    </section>
  )
}
