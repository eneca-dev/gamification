import { redirect } from 'next/navigation'

import { checkIsAdmin, getCalendarHolidays, getCalendarWorkdays } from '@/modules/admin'
import { CalendarClient } from '@/modules/admin/components/CalendarClient'

export default async function AdminCalendarPage() {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) redirect('/')

  const [holidays, workdays] = await Promise.all([
    getCalendarHolidays(),
    getCalendarWorkdays(),
  ])

  return <CalendarClient initialHolidays={holidays} initialWorkdays={workdays} />
}
