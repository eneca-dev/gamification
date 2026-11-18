import { createElement, type ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, it, vi } from 'vitest'
vi.mock('@/modules/profile-appearance/actions', () => ({
  getBimoStateAction: vi.fn(),
  purchaseBimoItem: vi.fn(async () => ({ success: true, data: null })),
  equipBimoItem: vi.fn(async () => ({ success: true, data: null })),
}))
import { useBimoEquip, useBimoPurchase } from '@/modules/profile-appearance/hooks'
it.each(['purchase', 'equip'])('Bimo %s keeps invalidation with custom callbacks', async mode => {
  const client = new QueryClient()
  for (const key of ['bimo', 'balance', 'orders']) client.setQueryData([key], 'before')
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children)
  const callback = vi.fn()
  const { result } = renderHook(() => ({ buy: useBimoPurchase({ onSuccess: callback }), equip: useBimoEquip({ onSuccess: callback }) }), { wrapper })
  await act(async () => {
    if (mode === 'purchase') await result.current.buy.mutateAsync({ productId: 'test' })
    else await result.current.equip.mutateAsync({ slot: 'accessory', assetKey: null })
  })
  expect(callback).toHaveBeenCalledOnce()
  expect(client.getQueryState(['bimo'])?.isInvalidated).toBe(true)
  expect(client.getQueryState(['balance'])?.isInvalidated).toBe(mode === 'purchase')
  expect(client.getQueryState(['orders'])?.isInvalidated).toBe(mode === 'purchase')
})
