'use client'

import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@/modules/cache/keys/query-keys'
import { fetchDashboardTransactions } from '../actions.client'

import type { Transaction } from '@/lib/data'

/** Последние операции пользователя. Обновляются realtime-инвалидацией,
 * refetchOnWindowFocus — страховка при обрыве соединения */
export function useRecentTransactions(userEmail: string, initialData?: Transaction[], limit = 5) {
  return useQuery({
    queryKey: queryKeys.transactions.recent(userEmail, limit),
    queryFn: () => fetchDashboardTransactions(userEmail, limit),
    initialData,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  })
}
