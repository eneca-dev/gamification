import { getEventTypes } from '@/modules/admin'
import { EventTypesTable } from '@/modules/admin/components/EventTypesTable'

export default async function AdminEventsPage() {
  const eventTypes = await getEventTypes()

  return <EventTypesTable eventTypes={eventTypes} />
}
