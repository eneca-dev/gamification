import type { ReactNode } from 'react'
import { Crown, Users, Zap } from 'lucide-react'

import { CoinIcon } from '@/components/CoinIcon'
import type { AdoptionMonthlyFilters, AdoptionMonthlyRanking, AdoptionMonthlyReport, AdoptionRankingArea, AdoptionRankingLevel } from '@/modules/admin'

import { InfoTooltip } from './InfoTooltip'

interface Props {
  current: AdoptionMonthlyReport
  previous: AdoptionMonthlyReport
  filters: AdoptionMonthlyFilters
}

const labels: Record<AdoptionRankingArea, string> = { revit: 'Revit', ws: 'Worksection' }
const levels: Record<AdoptionRankingLevel, string> = { personal: 'Личные', team: 'Командные', department: 'Отделы' }
const avatarColors = ['#607d8b', '#2196f3', '#e91e63', '#9c27b0', '#ff9800', '#4caf50', '#00bcd4', '#795548']

function pctOneDecimal(value: number, total: number) {
  return total ? Math.round((value / total) * 1000) / 10 : 0
}

function formatPct(value: number) {
  return value.toLocaleString('ru-RU', { maximumFractionDigits: 1 })
}

function monthLabel(month: string) {
  const [year, rawMonth] = month.split('-').map(Number)
  const names = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь']
  return `${names[rawMonth - 1]} ${year}`
}

function reportTitle(filters: AdoptionMonthlyFilters) {
  return `Итоги месяца — ${monthLabel(filters.month)}`
}

function Delta({ current, previous }: { current: number; previous: number }) {
  const delta = Math.round((current - previous) * 10) / 10
  if (!delta) return <span style={{ color: 'var(--apex-text-muted)' }}>без изменений к предыдущему периоду</span>
  return <span style={{ color: delta > 0 ? 'var(--apex-primary)' : '#dc2626' }}>{delta > 0 ? '+' : ''}{formatPct(delta)} п.п. к предыдущему периоду</span>
}

function StatCard({ label, value, hint, tooltip }: { label: string; value: ReactNode; hint: ReactNode; tooltip?: ReactNode }) {
  return (
    <div className="rounded-2xl p-5 flex flex-col gap-2 card-hover" style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}>
      <span className="flex items-center gap-1 text-[12px] font-medium" style={{ color: 'var(--apex-text-secondary)' }}>{label}{tooltip}</span>
      <strong className="text-[24px] leading-tight tabular-nums" style={{ color: 'var(--apex-text)' }}>{value}</strong>
      <span className="text-[11px]" style={{ color: 'var(--apex-text-muted)' }}>{hint}</span>
    </div>
  )
}

function initials(name: string) {
  const parts = name.split(' ').filter(Boolean)
  return parts.length > 1 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : name.slice(0, 2).toUpperCase()
}

function colorFor(key: string) {
  let hash = 0
  for (let index = 0; index < key.length; index++) hash = (hash << 5) - hash + key.charCodeAt(index)
  return avatarColors[Math.abs(hash) % avatarColors.length]
}

function RankBadge({ rank }: { rank: number }) {
  const background = rank === 1 ? 'var(--rank-gold)' : rank === 2 ? 'var(--rank-silver)' : rank === 3 ? 'var(--rank-bronze)' : 'var(--apex-bg)'
  return <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0" style={{ background, color: rank <= 3 ? 'white' : 'var(--apex-text-muted)', border: rank > 3 ? '1px solid var(--apex-border)' : 'none' }}>{rank}</span>
}

function RankingCard({ area, level, rows }: { area: AdoptionRankingArea; level: AdoptionRankingLevel; rows: AdoptionMonthlyRanking[] }) {
  const isRevit = area === 'revit'
  const accentColor = isRevit ? 'var(--orange-500)' : 'var(--apex-primary)'
  const title = `Топ ${labels[area]} · ${levels[level]}`
  return (
    <div className="rounded-2xl p-5 flex flex-col card-hover" style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}>
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {isRevit ? <Zap size={14} style={{ color: accentColor }} /> : <Crown size={14} style={{ color: accentColor }} />}
          <h3 className="text-[12px] font-semibold uppercase tracking-wider truncate" style={{ color: 'var(--apex-text-muted)' }}>{title}</h3>
        </div>
        {rows.some((row) => row.is_winner) && <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0" style={{ background: 'var(--apex-success-bg)', color: 'var(--apex-primary)', border: '1px solid rgba(var(--apex-primary-rgb), 0.15)' }}>победитель</span>}
      </div>
      {rows.length ? <ol className="space-y-1.5 max-h-[340px] overflow-y-auto scrollbar-hide">
        {rows.map((row) => (
          <li key={`${row.entity_id}-${row.rank}`} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: row.is_winner ? 'var(--apex-success-bg)' : row.rank === 1 ? 'var(--orange-50)' : 'transparent', border: row.is_winner ? '1px solid rgba(var(--apex-primary-rgb), 0.15)' : row.rank === 1 ? '1px solid rgba(var(--orange-500-rgb), 0.15)' : '1px solid transparent' }}>
            <RankBadge rank={row.rank} />
            <span className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0" style={{ background: colorFor(row.entity_id) }}>{level === 'department' ? <Users size={13} /> : initials(row.display_name)}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-semibold" style={{ color: 'var(--apex-text)' }}>{row.display_name}</div>
              {level !== 'personal' && <div className="text-[10px]" style={{ color: 'var(--apex-text-muted)' }}>{row.users_earning}/{row.total_employees} участников · {row.total_coins.toLocaleString('ru-RU')} кристаллов</div>}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <strong className="text-[14px] tabular-nums" style={{ color: accentColor }}>{(level === 'personal' ? row.total_coins : row.contest_score).toLocaleString('ru-RU')}</strong>
              {level === 'personal' && <CoinIcon size={14} />}
            </div>
          </li>
        ))}
      </ol> : <div className="flex flex-col items-center justify-center py-8 gap-2 rounded-xl" style={{ background: 'var(--apex-bg)', border: '1px solid var(--apex-border)' }}><span>📅</span><p className="text-[12px] font-medium text-center" style={{ color: 'var(--apex-text-muted)' }}>За месяц нет начислений в этой группе.</p></div>}
    </div>
  )
}

export function MonthlyAdoptionSection({ current, previous }: Props) {
  const summary = current.summary
  const previousSummary = previous.summary
  const gratitudePct = pctOneDecimal(summary.gratitude_senders, summary.registered_count)
  const previousGratitudePct = pctOneDecimal(previousSummary.gratitude_senders, previousSummary.registered_count)
  const shopPct = pctOneDecimal(summary.shop_buyers, summary.registered_count)
  const previousShopPct = pctOneDecimal(previousSummary.shop_buyers, previousSummary.registered_count)
  const shieldPct = pctOneDecimal(summary.shield_response_users, summary.shield_opportunity_users)
  const previousShieldPct = pctOneDecimal(previousSummary.shield_response_users, previousSummary.shield_opportunity_users)
  return (
    <section className="space-y-4">
      <div className="space-y-3">
        <div>
          <h3 className="text-[13px] font-semibold" style={{ color: 'var(--apex-text)' }}>Вовлечённость в геймификацию</h3>
          <p className="text-[11px]" style={{ color: 'var(--apex-text-muted)' }}>Добровольные действия пользователей за выбранный месяц.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <StatCard label="Используют благодарности" value={`${formatPct(gratitudePct)}%`} hint={<><b>{summary.gratitude_senders}</b> из {summary.registered_count} авторизованных · <Delta current={gratitudePct} previous={previousGratitudePct} /></>} tooltip={<InfoTooltip desc="Доля авторизованных сотрудников, которые отправили хотя бы одну благодарность за месяц." formula="уникальные отправители благодарностей / авторизованные к концу месяца × 100" />} />
          <StatCard label="Покупают в магазине" value={`${formatPct(shopPct)}%`} hint={<><b>{summary.shop_buyers}</b> из {summary.registered_count} авторизованных · <Delta current={shopPct} previous={previousShopPct} /></>} tooltip={<InfoTooltip desc="Доля авторизованных сотрудников, которые купили хотя бы одну реальную награду. Покупки «Второй жизни» сюда не входят." formula="уникальные покупатели реальных наград / авторизованные к концу месяца × 100" />} />
          <StatCard label="Реагируют на риск сброса стрика" value={`${formatPct(shieldPct)}%`} hint={<><b>{summary.shield_response_users}</b> из {summary.shield_opportunity_users} сотрудников с риском сброса · <Delta current={shieldPct} previous={previousShieldPct} /><br />Спасено {summary.shield_saved_opportunities} из {summary.shield_total_opportunities} случаев.</>} tooltip={<InfoTooltip desc="Показывает, какая доля сотрудников хотя бы раз вовремя заметила риск сброса WS- или Revit-стрика и использовала «Вторую жизнь». Несколько причин одного сброса в один день считаются одной возможностью." formula="пользователи «Второй жизни» / пользователи со щитом или фактическим сбросом стрика × 100" />} />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
        {(['revit', 'ws'] as const).flatMap((area) => (['personal', 'team', 'department'] as const).map((level) => <RankingCard key={`${area}-${level}`} area={area} level={level} rows={current.rankings.filter((row) => row.area === area && row.level === level)} />))}
      </div>
      <p className="text-[11px]" style={{ color: 'var(--apex-text-muted)' }}>Личный топ отсортирован по кристаллам. Команды и отделы — по конкурсному баллу. Метка победителя берётся из журнала конкурсных начислений.</p>
    </section>
  )
}

export function MonthlyAdoptionHeader({ filters }: Pick<Props, 'filters'>) {
  return (
    <div className="space-y-1">
      <h2 className="text-[16px] font-bold" style={{ color: 'var(--apex-text)' }}>{reportTitle(filters)}</h2>
      <p className="text-[12px]" style={{ color: 'var(--apex-text-secondary)' }}>Срез по выбранной когорте: вовлечённость, результаты Worksection и лидеры месяца.</p>
    </div>
  )
}
