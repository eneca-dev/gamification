import { Sidebar } from '@/components/Sidebar'
import { BetaAccessDenied } from '@/components/BetaAccessDenied'
import { getCurrentUser } from '@/modules/auth'
import { getUserBalance } from '@/modules/shop'
import { DevBanner } from '@/modules/dev-tools/components/DevBanner'
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
    <div className="flex min-h-screen">
      {user?.isImpersonating && (
        <DevBanner
          userName={user.fullName}
          userEmail={user.email}
          department={user.department}
        />
      )}
      <Sidebar user={user} balance={balance} showDevSwitcher={DEV_TOOLS_ENABLED} />
      <main className={`flex-1 ml-[260px] p-8 max-w-[1200px] ${user?.isImpersonating ? 'pt-14' : ''}`}>
        {children}
      </main>
    </div>
  )

  return user?.id ? (
    <OnboardingProvider userId={user.id}>{layout}</OnboardingProvider>
  ) : layout
}
