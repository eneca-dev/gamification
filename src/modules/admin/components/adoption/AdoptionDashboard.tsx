import type {
  AdoptionCoverageData,
  AdoptionOverviewData,
  AdoptionWorksectionData,
  AdoptionPluginsData,
  AdoptionSideEffectsData,
} from '@/modules/admin'

import { OverviewSection } from './OverviewSection'
import { WorksectionSection } from './WorksectionSection'
import { PluginsSection } from './PluginsSection'
import { SideEffectsSection } from './SideEffectsSection'

interface AdoptionDashboardProps {
  coverage: AdoptionCoverageData
  overview: AdoptionOverviewData
  worksection: AdoptionWorksectionData
  plugins: AdoptionPluginsData
  sideEffects: AdoptionSideEffectsData
}

export function AdoptionDashboard({ coverage, overview, worksection, plugins, sideEffects }: AdoptionDashboardProps) {
  return (
    <div className="space-y-8">
      <OverviewSection data={overview} coverage={coverage} wsDaily={worksection.daily} />
      <WorksectionSection data={worksection} />
      <PluginsSection data={plugins} />
      <SideEffectsSection data={sideEffects} />
    </div>
  )
}
