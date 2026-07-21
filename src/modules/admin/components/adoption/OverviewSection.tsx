'use client'

import { useState } from 'react'

import { ChevronDown, ChevronRight } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
  CartesianGrid, Label, Legend,
} from 'recharts'

import { CoinStatic } from '@/components/CoinBalance'

import { InfoTooltip, Fraction } from './InfoTooltip'

import type { AdoptionOverviewData, AdoptionCoverageData, AdoptionWsDay, AdoptionLoginDepartment, AdoptionLoginTeam } from '@/modules/admin'

const LAUNCH_DAY = '2026-07-01'

const LINE_LABELS: Record<string, string> = {
  logged_in: 'Вошли в систему',
  improved_ws: 'Улучшили дисциплину WS',
  improved_revit: 'Стали активнее в Revit',
  improved_ws_logged: 'Улучшили WS — вошли',
  improved_revit_logged: 'Активнее в Revit — вошли',
  improved_ws_not_logged: 'Улучшили WS — не вошли',
  improved_revit_not_logged: 'Активнее в Revit — не вошли',
}
// Легенда, в отличие от тултипа, явно подписывает пунктир — иначе на графике
// неочевидно, что дело именно в стиле линии, а не в цвете
const LEGEND_SUFFIX: Record<string, string> = {
  improved_ws_not_logged: ' (пунктир)',
  improved_revit_not_logged: ' (пунктир)',
}

// Вкладки графика улучшений: вся выборка или сравнение вошедших/не вошедших
type ImprovedTab = 'all' | 'compare'

// Линии вкладок: цвет WS — info, Revit — warning; пунктир — не вошедшие
const TAB_LINES: Record<ImprovedTab, { key: string; color: string; dashed?: boolean }[]> = {
  all: [
    { key: 'logged_in', color: 'var(--apex-primary)' },
    { key: 'improved_ws', color: 'var(--apex-info-text)' },
    { key: 'improved_revit', color: 'var(--apex-warning-text)' },
  ],
  compare: [
    { key: 'improved_ws_logged', color: 'var(--apex-info-text)' },
    { key: 'improved_revit_logged', color: 'var(--apex-warning-text)' },
    { key: 'improved_ws_not_logged', color: 'var(--apex-info-text)', dashed: true },
    { key: 'improved_revit_not_logged', color: 'var(--apex-warning-text)', dashed: true },
  ],
}

function TabChip({
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

interface Props {
  data: AdoptionOverviewData
  coverage: AdoptionCoverageData
  wsDaily: AdoptionWsDay[]
}

function formatDayLabel(day: string): string {
  const [, m, d] = day.split('-')
  return `${d}.${m}`
}

const tooltipStyle = {
  borderRadius: 8,
  border: '1px solid var(--apex-border)',
  fontSize: 12,
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
}

interface CoverageCardProps {
  label: string
  value: React.ReactNode
  sub: string
  tooltip?: React.ReactNode
}

function CoverageCard({ label, value, sub, tooltip }: CoverageCardProps) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-1"
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
        {sub}
      </span>
    </div>
  )
}

interface ChartCardProps {
  title: string
  note: string
  action?: React.ReactNode
  children: React.ReactNode
}

function ChartCard({ title, note, action, children }: ChartCardProps) {
  return (
    <div
      className="rounded-2xl p-4 space-y-3"
      style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
    >
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-[13px] font-semibold" style={{ color: 'var(--apex-text)' }}>
          {title}
        </h3>
        {action}
      </div>
      <div className="h-[220px]">{children}</div>
      <p className="text-[11px]" style={{ color: 'var(--apex-text-muted)' }}>
        {note}
      </p>
    </div>
  )
}

// Цвет процента входа: красный < 50%, зелёный >= 50%
function pctColor(pct: number): string {
  return pct >= 50 ? 'var(--apex-primary)' : 'var(--apex-danger)'
}

function PctBadge({ pct }: { pct: number }) {
  return (
    <span className="text-[12px] font-bold tabular-nums shrink-0" style={{ color: pctColor(pct) }}>
      {pct}%
    </span>
  )
}

// Человек в команде: цветной маркер по факту входа
function UserRow({ user }: { user: { name: string; logged_in: boolean } }) {
  const color = user.logged_in ? 'var(--apex-primary)' : 'var(--apex-danger)'
  return (
    <li className="flex items-center gap-2 pl-11 pr-2 py-0.5">
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
      <span className="min-w-0 flex-1 text-[11px] truncate" style={{ color: 'var(--apex-text-secondary)' }}>
        {user.name}
      </span>
      <span className="text-[10px] shrink-0" style={{ color }}>
        {user.logged_in ? 'вошёл' : 'не вошёл'}
      </span>
    </li>
  )
}

// Команда — раскрывается в список людей с цветным маркером входа.
// Открыта по умолчанию: монтируется только когда открыт отдел, так что
// раскрытие отдела сразу показывает всех людей во всех командах
function TeamRow({ team, label }: { team: AdoptionLoginTeam; label: string }) {
  const [open, setOpen] = useState(true)

  return (
    <li>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 pl-5 pr-2 py-1 text-left"
      >
        <ChevronRight
          size={11}
          className={`shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
          style={{ color: 'var(--apex-text-muted)' }}
        />
        <span className="min-w-0 flex-1 text-[11px] truncate" style={{ color: 'var(--apex-text-secondary)' }}>
          {label}
        </span>
        <span className="text-[10px] tabular-nums shrink-0" style={{ color: 'var(--apex-text-muted)' }}>
          {team.logged_in}/{team.total}
        </span>
        <PctBadge pct={team.pct} />
      </button>
      {open && (
        <ul className="pb-1">
          {team.users.map((u) => (
            <UserRow key={u.name} user={u} />
          ))}
        </ul>
      )}
    </li>
  )
}

// Отдел — раскрывается в список команд (или сразу в людей, если команда одна)
function DepartmentRow({ dept }: { dept: AdoptionLoginDepartment }) {
  const [open, setOpen] = useState(false)
  const singleTeam = dept.teams.length === 1 ? dept.teams[0] : null

  return (
    <div className="rounded-lg" style={{ background: 'var(--apex-bg)' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-left"
      >
        <ChevronRight
          size={12}
          className={`shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
          style={{ color: 'var(--apex-text-muted)' }}
        />
        <span className="min-w-0 flex-1 text-[12px] truncate" style={{ color: 'var(--apex-text)' }}>
          {dept.department}
        </span>
        <span className="text-[10px] tabular-nums shrink-0" style={{ color: 'var(--apex-text-muted)' }}>
          {dept.logged_in}/{dept.total}
        </span>
        <PctBadge pct={dept.pct} />
      </button>
      {open && (
        singleTeam ? (
          <ul className="pb-1.5">
            {singleTeam.users.map((u) => (
              <UserRow key={u.name} user={u} />
            ))}
          </ul>
        ) : (
          <ul className="pb-1.5">
            {dept.teams.map((t) => (
              <TeamRow key={t.team ?? '—'} team={t} label={t.team ?? 'Без команды'} />
            ))}
          </ul>
        )
      )}
    </div>
  )
}

export function OverviewSection({ data, coverage, wsDaily }: Props) {
  const { total_cohort, users_daily, revit_daily, login_by_department } = data
  const [improvedTab, setImprovedTab] = useState<ImprovedTab>('all')
  const [showLoginBreakdown, setShowLoginBreakdown] = useState(false)

  // Первый столбец — первая половина отсортированного списка, второй — продолжение
  const splitAt = Math.ceil(login_by_department.length / 2)
  const loginColumns = [login_by_department.slice(0, splitAt), login_by_department.slice(splitAt)]

  const notLoggedCount = total_cohort - coverage.profiles_count
  // На вкладке сравнения шкала и горизонтали — по размерам групп, не всей выборки
  const yMax = improvedTab === 'all' ? total_cohort : coverage.profiles_count
  const sizeRefs = improvedTab === 'all'
    ? [{ y: total_cohort, label: `Выборка: ${total_cohort}` }]
    : [
        { y: coverage.profiles_count, label: `Вошли: ${coverage.profiles_count}` },
        { y: notLoggedCount, label: `Не вошли: ${notLoggedCount}` },
      ]

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-[14px] font-bold" style={{ color: 'var(--apex-text)' }}>
          Общая картина по выборке проектировщиков
        </h2>
        <p className="text-[12px]" style={{ color: 'var(--apex-text-secondary)' }}>
          Все метрики — только по выборке: активные сотрудники отделов-проектировщиков.
          Точка отсчёта — 29–30 июня (два рабочих дня до запуска). Оранжевый пунктир на графиках —
          запуск геймификации 1 июля.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <CoverageCard
          label="Проектировщиков в выборке"
          value={String(coverage.total_employees)}
          sub={`активные сотрудники отделов-проектировщиков из ${coverage.company_total} сотрудников компании`}
          tooltip={
            <InfoTooltip
              desc="Основа всего дашборда: по этим людям считаются все метрики. Состав отделов-проектировщиков можно поменять вручную в дашборде «Экономика»."
              formula="COUNT активных сотрудников отделов-проектировщиков"
            />
          }
        />
        <CoverageCard
          label="Авторизовались в геймификации"
          value={`${coverage.profiles_count} (${coverage.profiles_pct}%)`}
          sub="из выборки зашли на платформу хотя бы раз"
          tooltip={
            <InfoTooltip
              desc="Деление на «вошли / не вошли» — основа сравнения в отчёте: разница между этими группами отражает вклад геймификации."
              formula={<><Fraction num="вошедшие" den="выборка" /> × 100</>}
            />
          }
        />
        <CoverageCard
          label="Заработано кристаллов с 1 июля"
          value={<CoinStatic amount={coverage.earned_total} size="xl" />}
          sub={`${coverage.earned_logged_pct}% — заработано вошедшими в приложение`}
          tooltip={
            <InfoTooltip
              desc="Сколько кристаллов выборка заработала с момента запуска. Сплит показывает, какая доля пришлась на вошедших в приложение."
              formula="Σ начислений > 0, с 01.07"
            />
          }
        />
      </div>

      <div className="space-y-3">
        <button
          onClick={() => setShowLoginBreakdown((v) => !v)}
          className="flex items-center gap-1.5 text-[12px] font-medium transition-colors"
          style={{ color: 'var(--apex-text-secondary)' }}
        >
          <ChevronDown
            size={14}
            className={`transition-transform ${showLoginBreakdown ? 'rotate-180' : ''}`}
          />
          {showLoginBreakdown ? 'Скрыть вход по отделам и командам' : 'Показать вход по отделам и командам'}
        </button>
        {showLoginBreakdown && (
          <div
            className="rounded-2xl p-4"
            style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[12px] font-semibold" style={{ color: 'var(--apex-text)' }}>
                Доля авторизовавшихся по отделам
              </span>
              <span className="text-[11px]" style={{ color: 'var(--apex-text-muted)' }}>
                худшие по входу — сверху
              </span>
            </div>
            <p className="text-[11px] mb-2" style={{ color: 'var(--apex-text-muted)' }}>
              Числа — вошли / всего в группе. Процент: <span style={{ color: 'var(--apex-danger)' }}>красный &lt; 50%</span>,{' '}
              <span style={{ color: 'var(--apex-primary)' }}>зелёный ≥ 50%</span>. Отдел раскрывается в команды и людей.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {loginColumns.map((column, i) => (
                <div key={i} className="max-h-[420px] overflow-y-auto pr-1 space-y-2">
                  {column.map((dept) => (
                    <DepartmentRow key={dept.department} dept={dept} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <ChartCard
        title="Вход в систему и личные улучшения"
        note={improvedTab === 'all'
          ? '«Вошли в систему» — авторизовались хотя бы раз к этому дню. «Улучшили дисциплину WS» — доля зелёных дней с 1 июля выше собственного уровня 29–30 июня. «Стали активнее в Revit» — запусков плагинов на рабочий день больше, чем до запуска (включая тех, кто раньше не пользовался). Точки 29–30 июня показывают уровень улучшений до запуска для сравнения: то же измерение относительно 25–26 июня.'
          : 'Те же улучшения раздельно по группам: сплошные линии — сотрудники, вошедшие в приложение, пунктирные — не вошедшие (контрольная группа). Группа определяется по факту входа на текущую дату. Точки 29–30 июня — уровень до запуска (сравнение с 25–26 июня).'}
        action={
          <div className="flex gap-1">
            <TabChip active={improvedTab === 'all'} onClick={() => setImprovedTab('all')}>
              Вся выборка
            </TabChip>
            <TabChip active={improvedTab === 'compare'} onClick={() => setImprovedTab('compare')}>
              Вошли vs не вошли
            </TabChip>
          </div>
        }
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={users_daily} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--apex-border)" vertical={false} />
            <XAxis
              dataKey="day"
              tickFormatter={formatDayLabel}
              tick={{ fontSize: 11, fill: 'var(--apex-text-muted)' }}
              tickLine={false}
              axisLine={false}
              interval={1}
            />
            <YAxis
              domain={[0, Math.ceil(yMax / 50) * 50]}
              tick={{ fontSize: 11, fill: 'var(--apex-text-muted)' }}
              tickLine={false}
              axisLine={false}
              width={38}
            />
            <Tooltip
              formatter={(val: number | undefined, name: string | undefined) => [
                val ?? '—',
                LINE_LABELS[name ?? ''] ?? name,
              ]}
              labelFormatter={(label: unknown) => formatDayLabel(String(label))}
              contentStyle={tooltipStyle}
            />
            <Legend
              formatter={(value: string) => `${LINE_LABELS[value] ?? value}${LEGEND_SUFFIX[value] ?? ''}`}
              wrapperStyle={{ fontSize: 11 }}
            />
            {sizeRefs.map((ref) => (
              <ReferenceLine key={ref.label} y={ref.y} stroke="var(--apex-text-muted)" strokeDasharray="4 3">
                <Label
                  value={ref.label}
                  position="insideTopLeft"
                  style={{ fontSize: 10, fill: 'var(--apex-text-muted)' }}
                />
              </ReferenceLine>
            ))}
            <ReferenceLine x={LAUNCH_DAY} stroke="var(--apex-warning-text)" strokeDasharray="4 3">
              <Label value="1 июля" position="insideTopRight" style={{ fontSize: 10, fill: 'var(--apex-warning-text)' }} />
            </ReferenceLine>
            {TAB_LINES[improvedTab].map((line) => (
              <Line
                key={`${improvedTab}-${line.key}`}
                type="monotone"
                dataKey={line.key}
                stroke={line.color}
                strokeWidth={2}
                strokeDasharray={line.dashed ? '6 4' : undefined}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ChartCard
          title="«Зелёные» дни по Worksection"
          note="Доля проектировщиков с зелёным вердиктом за рабочий день. За 29–30 июня — ретроспективный расчёт по тем же правилам."
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={wsDaily} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--apex-border)" vertical={false} />
              <XAxis
                dataKey="day"
                tickFormatter={formatDayLabel}
                tick={{ fontSize: 11, fill: 'var(--apex-text-muted)' }}
                tickLine={false}
                axisLine={false}
                interval={1}
              />
              <YAxis
                domain={[25, 75]}
                tickFormatter={(v: number) => `${v}%`}
                tick={{ fontSize: 11, fill: 'var(--apex-text-muted)' }}
                tickLine={false}
                axisLine={false}
                width={38}
              />
              <Tooltip
                formatter={(val: number | undefined) => [val !== undefined ? `${val}%` : '—', 'Зелёных']}
                labelFormatter={(label: unknown) => formatDayLabel(String(label))}
                contentStyle={tooltipStyle}
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
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Использование Revit-плагинов"
          note="Уникальных проектировщиков, запускавших плагины за рабочий день. За 29–30 июня — историческая выгрузка, с 1 июля — живой поток."
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={revit_daily} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--apex-border)" vertical={false} />
              <XAxis
                dataKey="day"
                tickFormatter={formatDayLabel}
                tick={{ fontSize: 11, fill: 'var(--apex-text-muted)' }}
                tickLine={false}
                axisLine={false}
                interval={1}
              />
              <YAxis
                domain={[35, 125]}
                tick={{ fontSize: 11, fill: 'var(--apex-text-muted)' }}
                tickLine={false}
                axisLine={false}
                width={38}
              />
              <Tooltip
                formatter={(val: number | undefined) => [val ?? '—', 'Пользователей']}
                labelFormatter={(label: unknown) => formatDayLabel(String(label))}
                contentStyle={tooltipStyle}
              />
              <ReferenceLine x={LAUNCH_DAY} stroke="var(--apex-warning-text)" strokeDasharray="4 3">
                <Label value="1 июля" position="insideTopRight" style={{ fontSize: 10, fill: 'var(--apex-warning-text)' }} />
              </ReferenceLine>
              <Line
                type="monotone"
                dataKey="users"
                stroke="var(--apex-primary)"
                strokeWidth={2}
                dot={{ r: 3, strokeWidth: 0, fill: 'var(--apex-primary)' }}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </section>
  )
}
