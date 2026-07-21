import { redirect } from 'next/navigation'

import {
  checkIsAdmin,
  getAdoptionCoverage,
  getAdoptionOverview,
  getAdoptionWorksection,
  getAdoptionPlugins,
  getAdoptionSideEffects,
} from '@/modules/admin'
import { AdoptionDashboard } from '@/modules/admin/components/adoption/AdoptionDashboard'

export default async function AdoptionPage() {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) redirect('/')

  const [coverage, overview, worksection, plugins, sideEffects] = await Promise.all([
    getAdoptionCoverage(),
    getAdoptionOverview(),
    getAdoptionWorksection(),
    getAdoptionPlugins(),
    getAdoptionSideEffects(),
  ])

  return (
    <AdoptionDashboard
      coverage={coverage}
      overview={overview}
      worksection={worksection}
      plugins={plugins}
      sideEffects={sideEffects}
    />
  )
}
