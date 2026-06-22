import { redirect } from 'next/navigation'

import {
  checkIsAdmin,
  getEconomyCategoryBreakdown,
  getEconomyOverview,
  getEconomyTop,
  resolveEconomyPeriod,
  getUsersSortedByBalance,
  getDepartmentGroups,
  getAllDepartments,
  getGratitudeAchievementExcess,
} from '@/modules/admin'
import { EconomyDashboard } from '@/modules/admin/components/economy/EconomyDashboard'
import { getCurrentRate } from '@/modules/shop'
import type { EconomyPeriodPreset, TopLevel, DesignerFilter, TopRow, LowBalanceUser } from '@/modules/admin'

// Вычитает излишек из топа «Заработавшие» с учётом уровня группировки.
function applyExcessToEarnedTop(
  rows: TopRow[],
  topLevel: TopLevel,
  excessByUser: Record<string, number>,
  users: LowBalanceUser[],
): TopRow[] {
  if (Object.keys(excessByUser).length === 0) return rows

  let excessByKey: Record<string, number>

  if (topLevel === 'user') {
    excessByKey = excessByUser
  } else {
    // Агрегируем излишек по команде или отделу
    excessByKey = {}
    for (const user of users) {
      const userExcess = excessByUser[user.id]
      if (!userExcess) continue
      const key = topLevel === 'team'
        ? (user.team ?? 'Без команды')
        : (user.department ?? 'Без отдела')
      excessByKey[key] = (excessByKey[key] ?? 0) + userExcess
    }
  }

  return rows
    .map((row) => ({ ...row, value: row.value - (excessByKey[row.id] ?? 0) }))
    .sort((a, b) => b.value - a.value)
}

interface EconomyPageProps {
  searchParams: Promise<{
    period?: string
    from?: string
    to?: string
    beta?: string
    topLevel?: string
    designerFilter?: string
    capGratAch?: string
  }>
}

const PERIOD_VALUES: EconomyPeriodPreset[] = ['7d', '30d', '90d', 'year', 'all', 'custom']
const LEVEL_VALUES: TopLevel[] = ['user', 'team', 'department']
const DESIGNER_FILTER_VALUES: DesignerFilter[] = ['all', 'designer', 'non_designer']

function isPeriod(v: string | undefined): v is EconomyPeriodPreset {
  return !!v && (PERIOD_VALUES as string[]).includes(v)
}

function isLevel(v: string | undefined): v is TopLevel {
  return !!v && (LEVEL_VALUES as string[]).includes(v)
}

function isDesignerFilter(v: string | undefined): v is DesignerFilter {
  return !!v && (DESIGNER_FILTER_VALUES as string[]).includes(v)
}

export default async function EconomyPage({ searchParams }: EconomyPageProps) {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) redirect('/')

  const params = await searchParams
  const period: EconomyPeriodPreset = isPeriod(params.period) ? params.period : 'all'
  const customFrom = params.from ?? ''
  const customTo = params.to ?? ''
  const betaOnly = params.beta !== 'off'
  const topLevel: TopLevel = isLevel(params.topLevel) ? params.topLevel : 'user'
  const designerFilter: DesignerFilter = isDesignerFilter(params.designerFilter)
    ? params.designerFilter
    : 'all'
  const capGratitudeAch = params.capGratAch === 'on'

  const { from, to } = resolveEconomyPeriod(period, customFrom, customTo)
  const filters = { from, to, betaOnly }

  const [
    overviewRaw,
    categories,
    earnedTop,
    shopTop,
    lotteryTop,
    secondLifeTop,
    paidGratitudeTop,
    revokedTop,
    rate,
    sortedUsers,
    deptGroups,
    allDepartments,
    gratitudeExcess,
  ] = await Promise.all([
    getEconomyOverview(filters),
    getEconomyCategoryBreakdown(filters),
    getEconomyTop(filters, 'earned', topLevel),
    getEconomyTop(filters, 'shop', topLevel),
    getEconomyTop(filters, 'lottery', topLevel),
    getEconomyTop(filters, 'second_life', topLevel),
    getEconomyTop(filters, 'paid_gratitude', topLevel),
    getEconomyTop(filters, 'revoked', topLevel),
    getCurrentRate(),
    getUsersSortedByBalance(filters),
    getDepartmentGroups(),
    getAllDepartments(),
    getGratitudeAchievementExcess(filters),
  ])

  const excessByUser = capGratitudeAch ? gratitudeExcess : {}
  const totalExcess = Object.values(excessByUser).reduce((a, b) => a + b, 0)

  // KPI: вычитаем суммарный излишек из заработанного
  const overview = totalExcess > 0
    ? {
        ...overviewRaw,
        earned: overviewRaw.earned - totalExcess,
        factually_earned: overviewRaw.factually_earned - totalExcess,
      }
    : overviewRaw

  // Заработавшие: корректируем с учётом уровня группировки
  const earnedTopAdjusted = applyExcessToEarnedTop(earnedTop, topLevel, excessByUser, sortedUsers)

  // Обогащаем пользователей группой отдела и вычитаем излишек из баланса
  const deptGroupMap = new Map(deptGroups.map((g) => [g.department, g.group_type]))
  const allWithGroups = sortedUsers
    .map((u) => ({
      ...u,
      total_coins: u.total_coins - (excessByUser[u.id] ?? 0),
      group_type: u.department ? (deptGroupMap.get(u.department) ?? 'non_designer' as const) : null,
    }))
    .sort((a, b) => a.total_coins - b.total_coins)  // пересортировка после коррекции

  // Формируем пул: сначала фильтр по группе, потом берём нижние/верхние 10%
  const pool =
    designerFilter === 'all'
      ? allWithGroups
      : allWithGroups.filter((u) => u.group_type === designerFilter)

  const edgeCount = Math.max(1, Math.ceil(pool.length * 0.1))
  const lowBalance = pool.slice(0, edgeCount)
  const highBalance = pool.slice(pool.length - edgeCount).reverse()

  return (
    <EconomyDashboard
      period={period}
      customFrom={customFrom}
      customTo={customTo}
      betaOnly={betaOnly}
      topLevel={topLevel}
      designerFilter={designerFilter}
      capGratitudeAch={capGratitudeAch}
      overview={overview}
      categories={categories}
      rate={rate}
      tops={{
        earned: earnedTopAdjusted,
        shop: shopTop,
        lottery: lotteryTop,
        second_life: secondLifeTop,
        paid_gratitude: paidGratitudeTop,
        revoked: revokedTop,
      }}
      lowBalance={lowBalance}
      highBalance={highBalance}
      poolSize={pool.length}
      allDepartments={allDepartments}
      deptGroups={deptGroups}
    />
  )
}
