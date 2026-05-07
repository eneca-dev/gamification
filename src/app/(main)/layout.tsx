import { BetaAccessDenied } from '@/components/BetaAccessDenied'
import { LayoutShell } from '@/components/LayoutShell'
import { getCurrentUser } from '@/modules/auth'
import { getUserBalance } from '@/modules/shop'
import { OnboardingProvider } from '@/modules/onboarding/index.client'

const DEV_TOOLS_ENABLED =
  process.env.NODE_ENV === 'development' ||
  process.env.ENABLE_DEV_TOOLS === 'true'

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  // Бета-режим: только бета-тестеры имеют доступ
  if (user && !user.isBetaTester) {
    return <BetaAccessDenied />
  }

  const balance = user?.wsUserId ? await getUserBalance(user.wsUserId) : 0

  const layout = (
    <LayoutShell user={user} balance={balance} showDevSwitcher={DEV_TOOLS_ENABLED}>
      {children}
    </LayoutShell>
  )

  return user?.id ? (
    <OnboardingProvider userId={user.id}>{layout}</OnboardingProvider>
  ) : layout
}
