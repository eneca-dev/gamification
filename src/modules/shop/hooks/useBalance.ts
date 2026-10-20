'use client'

import { createCacheQuery, queryKeys, staleTimePresets } from '@/modules/cache'
import { getBalanceAction } from '@/modules/shop/index.client'

const BALANCE_POLL_INTERVAL = 5 * 60 * 1000

export const useBalance = createCacheQuery({
  queryKey: (userId: string) => queryKeys.balance.current(userId),
  queryFn: () => getBalanceAction(),
  staleTime: staleTimePresets.realtime,
})

export { BALANCE_POLL_INTERVAL }
