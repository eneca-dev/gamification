'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { realtimeSubscriptions } from './config'

/**
 * Компонент без UI. Подписывается на изменения таблиц Supabase
 * и инвалидирует соответствующие query keys.
 * Монтируется один раз внутри QueryProvider.
 */
export function RealtimeSync() {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (realtimeSubscriptions.length === 0) return
  }, [queryClient])

  return null
}
