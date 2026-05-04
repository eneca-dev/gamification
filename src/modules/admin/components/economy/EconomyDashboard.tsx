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

      <KpiSummary overview={overview} />

      <SpendingBreakdown channels={overview.channels} />

      <CategoryBreakdownChart categories={categories} />

      <section className="space-y-3">
        <h2 className="text-[14px] font-bold" style={{ color: 'var(--apex-text)' }}>
          Топы
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TopList title="Заработавшие" items={tops.earned} iconName="award" />
          <TopList title="Тратящие в магазине" items={tops.shop} iconName="shoppingBag" secondaryLabel="покупок" />
          <TopList title="Участники лотереи" items={tops.lottery} iconName="ticket" secondaryLabel="билетов" />
          <TopList title="Покупатели второй жизни" items={tops.second_life} iconName="shield" secondaryLabel="покупок" />
          <TopList title="Отправители платных благодарностей" items={tops.paid_gratitude} iconName="heart" secondaryLabel="отправок" />
          <TopList title="Получившие отзывы" items={tops.revoked} iconName="alertTriangle" />
        </div>
      </section>
    </div>
  )
}
