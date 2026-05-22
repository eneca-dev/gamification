import type {
  CategoryRow,
  DepartmentGroupRow,
  DesignerFilter,
  EconomyOverview,
  EconomyPeriodPreset,
  LowBalanceUser,
  TopLevel,
  TopRow,
} from '@/modules/admin'

import { CategoryBreakdownChart } from './CategoryBreakdownChart'
import { DepartmentGroupsManager } from './DepartmentGroupsManager'
import { EconomyFilters } from './EconomyFilters'
import { KpiSummary } from './KpiSummary'
import { LowBalanceSection } from './LowBalanceSection'
import { SpendingBreakdown } from './SpendingBreakdown'
import { TopList } from './TopList'

interface EconomyDashboardProps {
  period: EconomyPeriodPreset
  customFrom: string
  customTo: string
  betaOnly: boolean
  topLevel: TopLevel
  designerFilter: DesignerFilter
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
  lowBalance: LowBalanceUser[]
  allDepartments: string[]
  deptGroups: DepartmentGroupRow[]
}

export function EconomyDashboard({
  period,
  customFrom,
  customTo,
  betaOnly,
  topLevel,
  designerFilter,
  overview,
  categories,
  rate,
  tops,
  lowBalance,
  allDepartments,
  deptGroups,
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

      <LowBalanceSection
        users={lowBalance}
        designerFilter={designerFilter}
        totalCount={lowBalance.length}
      />

      <DepartmentGroupsManager departments={allDepartments} initialGroups={deptGroups} />

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
