import { redirect } from 'next/navigation'

import {
  checkIsAdmin,
  getAdoptionCoverage,
  getAdoptionOverview,
  getAdoptionWorksection,
  getAdoptionPlugins,
  getAdoptionSideEffects,
} from '@/modules/admin'
import { getExportOptions } from '@/modules/admin/export/options'
import { AdoptionDashboard } from '@/modules/admin/components/adoption/AdoptionDashboard'

export default async function AdoptionPage() {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) redirect('/')

  const [coverage, overview, worksection, plugins, sideEffects, exportOptions] = await Promise.all([
    getAdoptionCoverage(),
    getAdoptionOverview(),
    getAdoptionWorksection(),
    getAdoptionPlugins(),
    getAdoptionSideEffects(),
    getExportOptions(),
  ])

  return (
    <AdoptionDashboard
      coverage={coverage}
      overview={overview}
      worksection={worksection}
      plugins={plugins}
      sideEffects={sideEffects}
      exportOptions={exportOptions}
    />
  )
}
