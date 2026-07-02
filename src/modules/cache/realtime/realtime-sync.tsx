'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { createSupabaseBrowserClient } from '@/config/supabase.client'

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

    const supabase = createSupabaseBrowserClient()

    const channels = realtimeSubscriptions.map((sub) =>
      supabase
        .channel(`realtime-${sub.table}`)
        .on(
          'postgres_changes',
          // cast: перегрузки supabase-js не принимают union-тип события
          { event: (sub.event ?? '*') as '*', schema: 'public', table: sub.table },
          () => {
            for (const key of sub.invalidateKeys) {
              queryClient.invalidateQueries({ queryKey: key })
            }
          }
        )
        .subscribe()
    )

    return () => {
      for (const channel of channels) {
        void supabase.removeChannel(channel)
      }
    }
  }, [queryClient])

  return null
}
