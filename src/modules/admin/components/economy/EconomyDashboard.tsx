import type {
  CategoryRow,
  EconomyOverview,
  EconomyPeriodPreset,
  TopLevel,
  TopRow,
} from '@/modules/admin'

import { CategoryBreakdownChart } from './CategoryBreakdownChart'
import { EconomyFilters } from './EconomyFilters'
import { KpiSummary } from './KpiSummary'
import { SpendingBreakdown } from './SpendingBreakdown'
import { TopList } from './TopList'

interface EconomyDashboardProps {
  period: EconomyPeriodPreset
  customFrom: string
  customTo: string
  betaOnly: boolean
  topLevel: TopLevel
  overview: EconomyOverview
  categories: CategoryRow[]
  rate: number
  tops: {
    earned: TopRow[]
    shop: TopRow[]
    lottery: TopRow[]
    second_life: TopRow[]
    paid_gratitude: TopRow[]
    revoked: TopRow[]
  }
}

export function EconomyDashboard({
  period,
  customFrom,
  customTo,
  betaOnly,
  topLevel,
  overview,
  categories,
  rate,
  tops,
}: EconomyDashboardProps) {
  return (
    <div className="space-y-6">
      <EconomyFilters
        period={period}
        customFrom={customFrom}
        customTo={customTo}
        betaOnly={betaOnly}
        topLevel={topLevel}
      />

      <KpiSummary overview={overview} rate={rate} />

      <SpendingBreakdown channels={overview.channels} rate={rate} />

      <CategoryBreakdownChart categories={categories} rate={rate} />

      <section className="space-y-3">
        <h2 className="text-[14px] font-bold" style={{ color: 'var(--apex-text)' }}>
          Топы
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TopList title="Заработавшие" items={tops.earned} iconName="award" rate={rate} />
          <TopList title="Тратящие в магазине" items={tops.shop} iconName="shoppingBag" secondaryLabel="покупок" rate={rate} />
          <TopList title="Участники лотереи" items={tops.lottery} iconName="ticket" secondaryLabel="билетов" rate={rate} />
          <TopList title="Покупатели второй жизни" items={tops.second_life} iconName="shield" secondaryLabel="покупок" rate={rate} />
          <TopList title="Отправители платных благодарностей" items={tops.paid_gratitude} iconName="heart" secondaryLabel="отправок" rate={rate} />
          <TopList title="Получившие отзывы" items={tops.revoked} iconName="alertTriangle" rate={rate} />
        </div>
      </section>
    </div>
  )
}
