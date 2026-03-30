import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/modules/auth/queries'
import { getMyGratitudesNew, getSenderQuota, getGratitudeRecipients, getUserBalance } from '@/modules/gratitudes'
import { GratitudeList } from '@/modules/gratitudes/components/GratitudeList'
import { SendGratitudeButton } from '@/modules/gratitudes/components/SendGratitudeButton'

export default async function GratitudesPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const wsUserId = user.wsUserId
  const userEmail = user.email ?? ''

  if (!wsUserId) redirect('/')

  const [myGratitudes, quota, recipients, balance] = await Promise.all([
    getMyGratitudesNew(userEmail, 100),
    getSenderQuota(wsUserId),
    getGratitudeRecipients(wsUserId),
    getUserBalance(wsUserId),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between animate-fade-in-up">
        <div>
          <h1 className="text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
            Благодарности
          </h1>
          <p className="text-sm font-medium mt-1" style={{ color: 'var(--text-secondary)' }}>
            Отправленные и полученные благодарности
          </p>
        </div>
        <SendGratitudeButton
          senderId={wsUserId}
          quota={quota}
          recipients={recipients}
          balance={balance}
        />
      </div>

      <div className="animate-fade-in-up stagger-1">
        <GratitudeList items={myGratitudes} currentUserEmail={userEmail} />
      </div>
    </div>
  )
}
