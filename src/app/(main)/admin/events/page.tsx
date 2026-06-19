import { redirect } from 'next/navigation'

import { checkIsAdmin, getEventTypes, getRankingSettings, getGratitudeSettings } from '@/modules/admin'
import { EventTypesTable } from '@/modules/admin/components/EventTypesTable'
import { AchievementSettings } from '@/modules/admin/components/AchievementSettings'

export default async function AdminEventsPage() {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) redirect('/')

  const [eventTypes, rankingSettings, gratitudeSettings] = await Promise.all([
    getEventTypes(),
    getRankingSettings(),
    getGratitudeSettings(),
  ])

  return (
    <div className="space-y-6">
      <EventTypesTable eventTypes={eventTypes} />
      <AchievementSettings rankingSettings={rankingSettings} gratitudeSettings={gratitudeSettings} />
    </div>
  )
}
