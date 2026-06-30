import { redirect } from 'next/navigation'

import { checkIsAdmin } from '@/modules/admin'
import { getAllDayOffRequestsAdmin, getScreenshotSignedUrl } from '@/modules/day-off'
import type { DayOffRequestAdmin } from '@/modules/day-off'
import { AdminDayOffList } from '@/modules/day-off/components/AdminDayOffList'

export default async function AdminDayOffPage() {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) redirect('/')

  const requests = await getAllDayOffRequestsAdmin()

  // Signed URLs генерируем только для активных (pending) заявок —
  // завершённые загружаются лениво при раскрытии раздела.
  const activeWithScreenshot = requests.filter(
    (r) => r.status === 'pending' && r.screenshot_url
  )

  const urlEntries = await Promise.all(
    activeWithScreenshot.map(async (r) => {
      const url = await getScreenshotSignedUrl(r.screenshot_url!)
      return [r.id, url] as [string, string | null]
    })
  )

  const screenshotUrls = Object.fromEntries(
    urlEntries.filter(([, url]) => url !== null) as [string, string][]
  )

  return (
    <div className="space-y-5">
      <div data-onboarding="admin-day-off-header">
        <h2 className="text-[16px] font-bold" style={{ color: 'var(--apex-text)' }}>
          Заявки на выходной
        </h2>
        <p className="text-[13px] mt-0.5" style={{ color: 'var(--apex-text-secondary)' }}>
          Геймификационные выходные сотрудников
        </p>
      </div>
      <AdminDayOffList requests={requests} screenshotUrls={screenshotUrls} />
    </div>
  )
}
