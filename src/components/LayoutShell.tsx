'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'

import { Sidebar } from '@/components/Sidebar'
import { FeedbackButton } from '@/modules/feedback/components/FeedbackButton'
import { ChatWidget } from '@/modules/chat/components/ChatWidget'
import type { AuthUser } from '@/modules/auth/index.client'

interface LayoutShellProps {
  user: AuthUser | null
  balance: number
  showDevSwitcher: boolean
  dayOffResolved: string[]
  children: React.ReactNode
}

export function LayoutShell({ user, balance, showDevSwitcher, dayOffResolved, children }: LayoutShellProps) {
  const [isSidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  return (
    <div className="flex min-h-screen">
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        user={user}
        balance={balance}
        showDevSwitcher={showDevSwitcher}
        isMobileOpen={isSidebarOpen}
        dayOffResolved={dayOffResolved}
      />

      <div className="flex-1 min-w-0 ml-0 md:ml-[260px]">
        <header
          className="sticky top-0 z-20 flex items-center gap-3 px-4 h-14 md:hidden"
          style={{ background: 'var(--apex-surface)', borderBottom: '1px solid var(--apex-border)' }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-black/5 transition-colors"
            style={{ color: 'var(--apex-text)' }}
            aria-label="Открыть меню"
          >
            <Menu size={20} />
          </button>
          <span className="font-bold text-sm" style={{ color: 'var(--apex-text)' }}>
            Геймификация
          </span>
        </header>

        <main className="mx-auto p-4 md:p-8 2xl:p-10
          max-w-[1200px] 2xl:max-w-[1600px] 3xl:max-w-[2280px] ultrawide:max-w-[3160px]">
          {children}
        </main>
      </div>

      <ChatWidget userId={user?.id ?? null} />
      <FeedbackButton />
    </div>
  )
}
