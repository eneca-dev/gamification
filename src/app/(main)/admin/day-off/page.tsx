import { redirect } from 'next/navigation'

import { checkIsAdmin } from '@/modules/admin'
import { getAllDayOffRequestsAdmin, getScreenshotSignedUrl } from '@/modules/day-off'
import type { DayOffRequestAdmin } from '@/modules/day-off'
import { AdminDayOffList } from '@/modules/day-off/components/AdminDayOffList'
import { AdminDayOffInstructions } from '@/modules/day-off/components/AdminDayOffInstructions'

export default async function AdminDayOffPage() {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) redirect('/')

  const requests = await getAllDayOffRequestsAdmin()

  // Signed URLs генерируем для всех заявок со скриншотом —
  // и активных, и завершённых.
  const withScreenshot = requests.filter((r) => r.screenshot_url)

  const urlEntries = await Promise.all(
    withScreenshot.map(async (r) => {
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
      <AdminDayOffInstructions />
      <AdminDayOffList requests={requests} screenshotUrls={screenshotUrls} />
    </div>
  )
}
