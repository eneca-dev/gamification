import { cookies } from 'next/headers'
import { LayoutShell } from '@/components/LayoutShell'
import { getCurrentUser } from '@/modules/auth'
import { getUserBalance } from '@/modules/shop'
import { getUserDayOffResolvedTimestamps } from '@/modules/day-off'
import { OnboardingProvider } from '@/modules/onboarding/index.client'

// Подмена пользователя отключена: переключатель больше не нужен ни в одном
// окружении. Переменная ENABLE_DEV_TOOLS больше ни на что не влияет; чтобы
// вернуть инструмент, восстановите прежнюю проверку окружения.
const DEV_TOOLS_ENABLED: boolean = false

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  const balance = user?.wsUserId ? await getUserBalance(user.wsUserId) : 0
  const dayOffResolved = user?.wsUserId ? await getUserDayOffResolvedTimestamps(user.wsUserId) : []
  const sidebarCollapsed = (await cookies()).get('sidebar_collapsed')?.value === 'true'

  const layout = (
    <LayoutShell user={user} balance={balance} showDevSwitcher={DEV_TOOLS_ENABLED} dayOffResolved={dayOffResolved} sidebarCollapsed={sidebarCollapsed}>
      {children}
    </LayoutShell>
  )

  return user?.id ? (
    <OnboardingProvider userId={user.id}>{layout}</OnboardingProvider>
  ) : layout
}
