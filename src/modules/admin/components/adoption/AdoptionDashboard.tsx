import type {
  AdoptionCoverageData,
  AdoptionOverviewData,
  AdoptionWorksectionData,
  AdoptionPluginsData,
  AdoptionSideEffectsData,
} from '@/modules/admin'
import type { ExportOptions } from '@/modules/admin/export/types'

import { OverviewSection } from './OverviewSection'
import { WorksectionSection } from './WorksectionSection'
import { PluginsSection } from './PluginsSection'
import { SideEffectsSection } from './SideEffectsSection'
import { ExportPanel } from './ExportPanel'

interface AdoptionDashboardProps {
  coverage: AdoptionCoverageData
  overview: AdoptionOverviewData
  worksection: AdoptionWorksectionData
  plugins: AdoptionPluginsData
  sideEffects: AdoptionSideEffectsData
  exportOptions: ExportOptions
}

export function AdoptionDashboard({ coverage, overview, worksection, plugins, sideEffects, exportOptions }: AdoptionDashboardProps) {
  return (
    <div className="space-y-8">
      <ExportPanel options={exportOptions} />
      <OverviewSection data={overview} coverage={coverage} wsDaily={worksection.daily} />
      <WorksectionSection data={worksection} />
      <PluginsSection data={plugins} />
      <SideEffectsSection data={sideEffects} />
    </div>
  )
}
