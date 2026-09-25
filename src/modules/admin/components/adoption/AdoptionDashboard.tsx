import type {
  AdoptionCoverageData,
  AdoptionOverviewData,
  AdoptionWorksectionData,
  AdoptionPluginsData,
  AdoptionSideEffectsData,
  AdoptionMonthlyFilters,
  AdoptionMonthlyReport,
  AdoptionCohortScope,
  AdoptionDateRange,
} from '@/modules/admin'
import type { ExportOptions } from '@/modules/admin/export/types'

import { OverviewSection } from './OverviewSection'
import { WorksectionSection } from './WorksectionSection'
import { PluginsSection } from './PluginsSection'
import { SideEffectsSection } from './SideEffectsSection'
import { ExportPanel } from './ExportPanel'
import { AdoptionReportFilters } from './AdoptionReportFilters'
import { MonthlyAdoptionHeader, MonthlyAdoptionSection } from './MonthlyAdoptionSection'
import { AdoptionDateFilter } from './AdoptionDateFilter'

interface AdoptionDashboardProps {
  coverage: AdoptionCoverageData
  overview: AdoptionOverviewData
  worksection: AdoptionWorksectionData
  plugins: AdoptionPluginsData
  sideEffects: AdoptionSideEffectsData
  exportOptions: ExportOptions
  monthly: AdoptionMonthlyReport
  previousMonthly: AdoptionMonthlyReport
  monthlyFilters: AdoptionMonthlyFilters
  departments: string[]
  dateRange: AdoptionDateRange
}

export function AdoptionDashboard({ coverage, overview, worksection, plugins, sideEffects, exportOptions, monthly, previousMonthly, monthlyFilters, departments, dateRange }: AdoptionDashboardProps) {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <ExportPanel options={exportOptions} />
        <AdoptionDateFilter from={dateRange.from} to={dateRange.to} />
      </div>
      <OverviewSection data={overview} coverage={coverage} wsDaily={worksection.daily} />
      <WorksectionSection data={worksection} />
      <PluginsSection data={plugins} />
      <SideEffectsSection data={sideEffects} range={dateRange} />
      <section className="space-y-4 pt-2">
        <MonthlyAdoptionHeader filters={monthlyFilters} />
        <AdoptionReportFilters month={monthlyFilters.month} scope={monthlyFilters.scope as AdoptionCohortScope} selectedDepartments={monthlyFilters.departments} departments={departments} />
        <MonthlyAdoptionSection current={monthly} previous={previousMonthly} filters={monthlyFilters} />
      </section>
    </div>
  )
}
