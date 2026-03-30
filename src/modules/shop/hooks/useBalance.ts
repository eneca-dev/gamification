'use client'

import { createSimpleCacheQuery, queryKeys, staleTimePresets } from '@/modules/cache'
import { getBalanceAction } from '@/modules/shop/index.client'

const BALANCE_POLL_INTERVAL = 30_000

export const useBalance = createSimpleCacheQuery({
  queryKey: queryKeys.balance.current(),
  queryFn: getBalanceAction,
  staleTime: staleTimePresets.realtime,
})

export { BALANCE_POLL_INTERVAL }
