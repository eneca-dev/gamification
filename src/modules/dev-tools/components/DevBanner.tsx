'use client'

import { useTransition } from 'react'
import { X } from 'lucide-react'

import { clearImpersonation } from '@/modules/dev-tools/actions'

interface DevBannerProps {
  userName: string
  userEmail: string
  department: string | null
}

export function DevBanner({ userName, userEmail, department }: DevBannerProps) {
  const [isPending, startTransition] = useTransition()

  function handleClear() {
    startTransition(async () => {
      await clearImpersonation()
    })
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-3 px-4 py-2 text-xs font-medium bg-amber-400 text-amber-950">
      <span>
        DEV: Просмотр как <strong>{userName}</strong>
        {department && <span className="ml-1 opacity-70">({department})</span>}
        <span className="ml-2 opacity-50">{userEmail}</span>
      </span>
      <button
        onClick={handleClear}
        disabled={isPending}
        className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-600/20 hover:bg-amber-600/30 transition-colors"
      >
        <X size={12} />
        Выйти
      </button>
    </div>
  )
}
