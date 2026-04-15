import { Sidebar } from '@/components/Sidebar'
import { getCurrentUser } from '@/modules/auth'
import { getUserBalance } from '@/modules/shop'
import { DevBanner } from '@/modules/dev-tools/components/DevBanner'
import { OnboardingProvider } from '@/modules/onboarding/index.client'

const IS_DEV = process.env.NODE_ENV === 'development'

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  const balance = user?.wsUserId ? await getUserBalance(user.wsUserId) : 0

  return (
    <div className="flex min-h-screen">
      {user?.isImpersonating && (
        <DevBanner
          userName={user.fullName}
          userEmail={user.email}
          department={user.department}
        />
      )}
      <Sidebar user={user} balance={balance} showDevSwitcher={IS_DEV} />
      <main className={`flex-1 ml-[260px] p-8 max-w-[1200px] ${user?.isImpersonating ? 'pt-14' : ''}`}>
        {user?.id ? (
          <OnboardingProvider userId={user.id}>
            {children}
          </OnboardingProvider>
        ) : children}
      </main>
    </div>
  )
}
