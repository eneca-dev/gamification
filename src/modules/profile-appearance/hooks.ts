'use client'

import { createCacheQuery, createCacheMutation, queryKeys } from '@/modules/cache'
import { getBimoStateAction, purchaseBimoItem, equipBimoItem } from './actions'

export const useBimo = createCacheQuery({
  queryKey: (userId: string) => queryKeys.bimo.user(userId),
  queryFn: () => getBimoStateAction(),
  staleTime: 0,
})
export const useBimoPurchase = createCacheMutation({
  mutationFn: purchaseBimoItem,
  invalidateKeys: [queryKeys.bimo.all, queryKeys.balance.all, queryKeys.orders.all],
})
export const useBimoEquip = createCacheMutation({
  mutationFn: equipBimoItem,
  invalidateKeys: [queryKeys.bimo.all],
})
