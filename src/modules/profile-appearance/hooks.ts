'use client'

import { createCacheQuery, createCacheMutation, queryKeys, staleTimePresets } from '@/modules/cache'
import { getBimoStateAction, purchaseBimoItem, equipBimoItem } from './actions'

// Гардероб меняется только действиями самого пользователя, а они инвалидируют
// ключ. Поэтому полная перезагрузка на каждом монтировании не нужна.
export const useBimo = createCacheQuery({
  queryKey: (userId: string) => queryKeys.bimo.user(userId),
  queryFn: () => getBimoStateAction(),
  staleTime: staleTimePresets.realtime,
})
export const useBimoPurchase = createCacheMutation({
  mutationFn: purchaseBimoItem,
  invalidateKeys: [queryKeys.bimo.all, queryKeys.balance.all, queryKeys.orders.all],
})
export const useBimoEquip = createCacheMutation({
  mutationFn: equipBimoItem,
  invalidateKeys: [queryKeys.bimo.all],
})
