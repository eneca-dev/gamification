import { Sidebar } from '@/components/Sidebar'
import { getCurrentUser } from '@/modules/auth'

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} />
      <main className="flex-1 ml-[260px] p-8 max-w-[1200px]">{children}</main>
    </div>
  )
}
