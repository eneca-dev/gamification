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
} from '@/modules/admin'
import { EconomyDashboard } from '@/modules/admin/components/economy/EconomyDashboard'
import { getCurrentRate } from '@/modules/shop'
import type { EconomyPeriodPreset, TopLevel, DesignerFilter } from '@/modules/admin'

interface EconomyPageProps {
  searchParams: Promise<{
    period?: string
    from?: string
    to?: string
    beta?: string
    topLevel?: string
    designerFilter?: string
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

  const { from, to } = resolveEconomyPeriod(period, customFrom, customTo)
  const filters = { from, to, betaOnly }

  const [
    overview,
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
    getUsersSortedByBalance(betaOnly),
    getDepartmentGroups(),
    getAllDepartments(),
  ])

  // Обогащаем пользователей группой отдела
  const deptGroupMap = new Map(deptGroups.map((g) => [g.department, g.group_type]))
  const allWithGroups = sortedUsers.map((u) => ({
    ...u,
    group_type: u.department ? (deptGroupMap.get(u.department) ?? 'non_designer' as const) : null,
  }))

  // Формируем пул: сначала фильтр по группе, потом берём нижние 10%
  const pool =
    designerFilter === 'all'
      ? allWithGroups
      : allWithGroups.filter((u) => u.group_type === designerFilter)

  const bottomCount = Math.max(1, Math.ceil(pool.length * 0.1))
  const lowBalance = pool.slice(0, bottomCount)

  return (
    <EconomyDashboard
      period={period}
      customFrom={customFrom}
      customTo={customTo}
      betaOnly={betaOnly}
      topLevel={topLevel}
      designerFilter={designerFilter}
      overview={overview}
      categories={categories}
      rate={rate}
      tops={{
        earned: earnedTop,
        shop: shopTop,
        lottery: lotteryTop,
        second_life: secondLifeTop,
        paid_gratitude: paidGratitudeTop,
        revoked: revokedTop,
      }}
      lowBalance={lowBalance}
      lowBalanceTotalCount={pool.length}
      allDepartments={allDepartments}
      deptGroups={deptGroups}
    />
  )
}
