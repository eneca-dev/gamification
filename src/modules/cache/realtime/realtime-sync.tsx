'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { realtimeSubscriptions } from './config'

// После настройки Supabase в @/config/supabase — раскомментировать:
// import { supabase } from '@/config/supabase'

/**
 * Компонент без UI. Подписывается на изменения таблиц Supabase
 * и инвалидирует соответствующие query keys.
 * Монтируется один раз внутри QueryProvider.
 */
export function RealtimeSync() {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (realtimeSubscriptions.length === 0) return

    // TODO: подключить после настройки @/config/supabase
    //
    // const channels = realtimeSubscriptions.map((sub) =>
    //   supabase
    //     .channel(`realtime:${sub.table}`)
    //     .on(
    //       'postgres_changes',
    //       { event: sub.event ?? '*', schema: 'public', table: sub.table },
    //       () => {
    //         sub.invalidateKeys.forEach((key) => {
    //           queryClient.invalidateQueries({ queryKey: key as readonly unknown[] })
    //         })
    //       }
    //     )
    //     .subscribe()
    // )
    //
    // return () => {
    //   channels.forEach((ch) => supabase.removeChannel(ch))
    // }
  }, [queryClient])

  return null
}
