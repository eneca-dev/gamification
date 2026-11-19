import { redirect } from 'next/navigation'

import { checkIsAdmin } from '@/modules/admin'
import { getAppealsList } from '@/modules/feedback'
import { AppealsTable } from '@/modules/feedback/components/AppealsTable'

export default async function AdminAppealsPage() {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) redirect('/')

  const items = await getAppealsList()

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold" style={{ color: 'var(--apex-text)' }}>
          Обжалования списаний
        </h2>
        <p className="text-xs mt-0.5" style={{ color: 'var(--apex-text-secondary)' }}>
          Запросы сотрудников на пересмотр списания 💎. Клик по строке — переход в карточку корректировки пользователя.
        </p>
      </div>

      <AppealsTable items={items} />
    </div>
  )
}
