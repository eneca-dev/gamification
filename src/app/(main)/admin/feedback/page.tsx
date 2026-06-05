import { redirect } from 'next/navigation'

import { checkIsAdmin } from '@/modules/admin'
import { getFeedbackList } from '@/modules/feedback'
import { FeedbackTable } from '@/modules/feedback/components/FeedbackTable'

export default async function AdminFeedbackPage() {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) redirect('/')

  const items = await getFeedbackList()

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold" style={{ color: 'var(--apex-text)' }}>
          Обратная связь
        </h2>
        <p className="text-xs mt-0.5" style={{ color: 'var(--apex-text-secondary)' }}>
          Баги и предложения от пользователей
        </p>
      </div>

      <FeedbackTable items={items} />
    </div>
  )
}
