import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/modules/auth/queries'
import { getUserDayOffRequests, getUserAbsenceDates } from '@/modules/day-off'
import { DayOffContent } from '@/modules/day-off/components/DayOffContent'

export default async function DayOffPage() {
  const user = await getCurrentUser()
  if (!user?.wsUserId) redirect('/signin')

  const [requests, absenceDates] = await Promise.all([
    getUserDayOffRequests(user.wsUserId),
    getUserAbsenceDates(user.wsUserId),
  ])

  const ABSENCE_LABELS: Record<string, string> = {
    vacation:   'Отпуск',
    sick_leave: 'Больничный',
    sick_day:   'Больничный',
  }

  const bookedDates: Record<string, string> = {
    ...Object.fromEntries(
      requests
        .filter(r => r.status === 'pending' || r.status === 'approved')
        .map(r => [r.requested_date, 'Выходной уже запрошен'])
    ),
    ...Object.fromEntries(
      absenceDates.map(a => [a.absence_date, ABSENCE_LABELS[a.absence_type] ?? 'Недоступно'])
    ),
  }

  return (
    <div className="space-y-5">
      <div className="animate-fade-in-up" data-onboarding="day-off-header">
        <h1 className="text-[20px] font-bold" style={{ color: 'var(--apex-text)' }}>
          Запросить выходной
        </h1>
        <p className="text-[13px] font-medium mt-1" style={{ color: 'var(--apex-text-secondary)' }}>
          Заявка на выходной день в системе геймификации
        </p>
      </div>

      <DayOffContent initialRequests={requests} bookedDates={bookedDates} />
    </div>
  )
}
