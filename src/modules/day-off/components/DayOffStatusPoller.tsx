'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface DayOffStatusPollerProps {
  hasActiveRequest: boolean
}

// Обновляет страницу каждые 30 сек и при возврате фокуса,
// пока есть активная заявка в статусе pending.
export function DayOffStatusPoller({ hasActiveRequest }: DayOffStatusPollerProps) {
  const router = useRouter()
  const refreshRef = useRef(router.refresh.bind(router))
  const lastRefreshRef = useRef(0)

  useEffect(() => {
    refreshRef.current = router.refresh.bind(router)
  })

  useEffect(() => {
    if (!hasActiveRequest) return

    const interval = setInterval(() => refreshRef.current(), 30_000)

    function handleFocus() {
      const now = Date.now()
      // Debounce: не чаще раза в 10 секунд при переключении вкладок
      if (now - lastRefreshRef.current < 10_000) return
      lastRefreshRef.current = now
      refreshRef.current()
    }

    window.addEventListener('focus', handleFocus)

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
    }
  }, [hasActiveRequest])

  return null
}
