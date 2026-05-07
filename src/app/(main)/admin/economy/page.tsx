import { redirect } from 'next/navigation'

import {
  checkIsAdmin,
  getEconomyCategoryBreakdown,
  getEconomyOverview,
  getEconomyTop,
  resolveEconomyPeriod,
} from '@/modules/admin'
import { EconomyDashboard } from '@/modules/admin/components/economy/EconomyDashboard'
import { getCurrentRate } from '@/modules/shop'
import type { EconomyPeriodPreset, TopLevel } from '@/modules/admin'

interface EconomyPageProps {
  searchParams: Promise<{
    period?: string
    from?: string
    to?: string
    beta?: string
    topLevel?: string
  }>
}

const PERIOD_VALUES: EconomyPeriodPreset[] = ['7d', '30d', '90d', 'year', 'all', 'custom']
const LEVEL_VALUES: TopLevel[] = ['user', 'team', 'department']

function isPeriod(v: string | undefined): v is EconomyPeriodPreset {
  return !!v && (PERIOD_VALUES as string[]).includes(v)
}

function isLevel(v: string | undefined): v is TopLevel {
  return !!v && (LEVEL_VALUES as string[]).includes(v)
}

export default async function EconomyPage({ searchParams }: EconomyPageProps) {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) redirect('/')

  const params = await searchParams
  const period: EconomyPeriodPreset = isPeriod(params.period) ? params.period : 'all'
  const customFrom = params.from ?? ''
  const customTo = params.to ?? ''
  const betaOnly = params.beta !== 'off' // по умолчанию ON
  const topLevel: TopLevel = isLevel(params.topLevel) ? params.topLevel : 'user'

  const { from, to } = resolveEconomyPeriod(period, customFrom, customTo)
  const filters = { from, to, betaOnly }

  const [overview, categories, earnedTop, shopTop, lotteryTop, secondLifeTop, paidGratitudeTop, revokedTop, rate] =
    await Promise.all([
      getEconomyOverview(filters),
      getEconomyCategoryBreakdown(filters),
      getEconomyTop(filters, 'earned', topLevel),
      getEconomyTop(filters, 'shop', topLevel),
      getEconomyTop(filters, 'lottery', topLevel),
      getEconomyTop(filters, 'second_life', topLevel),
      getEconomyTop(filters, 'paid_gratitude', topLevel),
      getEconomyTop(filters, 'revoked', topLevel),
      getCurrentRate(),
    ])

  return (
    <EconomyDashboard
      period={period}
      customFrom={customFrom}
      customTo={customTo}
      betaOnly={betaOnly}
      topLevel={topLevel}
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
    />
  )
}
