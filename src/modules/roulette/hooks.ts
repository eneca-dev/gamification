'use client'

import { useEffect } from 'react'
import { createCacheMutation, createCacheQuery, queryKeys, refreshQueries, useQueryClient } from '@/modules/cache'
import { getRouletteStateAction, prepareRouletteAction, recoverRouletteAction, spinRouletteAction } from './actions'

const useStateQuery = createCacheQuery({
  queryKey: (userId: string) => queryKeys.roulette.user(userId),
  queryFn: () => getRouletteStateAction(),
  staleTime: 0,
})
export function useRouletteState(userId: string, options?: Parameters<typeof useStateQuery>[1]) {
  const query = useStateQuery(userId, options)
  const client = useQueryClient()
  const completed = query.data?.result?.operationId
  useEffect(() => {
    if (completed) void refreshQueries(client, [queryKeys.balance.current(userId)], false).catch(() => {})
  }, [client, userId, completed])
  return query
}
export const usePrepareRoulette = createCacheMutation({ mutationFn: prepareRouletteAction })
const useSpin = createCacheMutation({
  mutationFn: spinRouletteAction,
  invalidateKeys: [queryKeys.balance.all, queryKeys.roulette.all, queryKeys.transactions.all],
})
export function useRouletteSpin() {
  const client = useQueryClient()
  return useSpin({
    retry: false,
    // Also refresh after an uncertain response; never infer a new balance from the saved result.
    onSettled: (_data, error) => error ? refreshQueries(client, [queryKeys.balance.all, queryKeys.roulette.all]) : undefined,
  })
}
export const useRecoverRoulette = createCacheMutation({
  mutationFn: recoverRouletteAction,
  invalidateKeys: [queryKeys.balance.all, queryKeys.roulette.all, queryKeys.transactions.all],
})
