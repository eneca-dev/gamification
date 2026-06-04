import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/modules/auth/queries'
import { getUserDayOffRequests } from '@/modules/day-off'
import { DayOffContent } from '@/modules/day-off/components/DayOffContent'

export default async function DayOffPage() {
  const user = await getCurrentUser()
  if (!user?.wsUserId) redirect('/signin')

  const requests = await getUserDayOffRequests(user.wsUserId)
  const bookedDates = requests
    .filter(r => r.status === 'pending' || r.status === 'approved')
    .map(r => r.requested_date)

  return (
    <div className="space-y-5">
      <div className="animate-fade-in-up">
        <h1 className="text-[20px] font-bold" style={{ color: 'var(--apex-text)' }}>
          Взять выходной
        </h1>
        <p className="text-[13px] font-medium mt-1" style={{ color: 'var(--apex-text-secondary)' }}>
          Заявка на выходной день в системе геймификации
        </p>
      </div>

      <DayOffContent initialRequests={requests} bookedDates={bookedDates} />
    </div>
  )
}
