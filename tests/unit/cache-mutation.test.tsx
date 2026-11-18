import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { createCacheMutation } from '@/modules/cache/hooks/use-cache-mutation'
import { ActionError, unwrapResult } from '@/modules/cache/utils/action-helpers'
import { refreshQueries } from '@/modules/cache/utils/refresh-queries'

function harness() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children)
  return { client, wrapper }
}
it('invalidates after commit despite failing hook and per-call success callbacks', async () => {
  const { client, wrapper } = harness()
  client.setQueryData(['balance'], 1000)
  const invalidated = vi.spyOn(client, 'invalidateQueries')
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  const callback = vi.fn(() => { throw new Error('animation failed') })
  const useSpin = createCacheMutation({
    mutationFn: async () => ({ success: true as const, data: 'committed' }),
    invalidateKeys: [['balance']], onSuccess: callback,
  })
  const { result } = renderHook(() => useSpin({ onSuccess: callback }), { wrapper })
  await act(async () => {
    await expect(result.current.mutateAsync(undefined, { onSuccess: callback })).resolves.toBe('committed')
  })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(invalidated).toHaveBeenCalled()
  expect(callback).toHaveBeenCalledTimes(3)
  expect(client.getQueryState(['balance'])?.isInvalidated).toBe(true)
  log.mockRestore()
})
it('calls the consumer even if required refresh fails, without failing the committed mutation', async () => {
  const { client, wrapper } = harness()
  vi.spyOn(client, 'invalidateQueries').mockRejectedValue(new Error('offline'))
  const callback = vi.fn()
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  const useBuy = createCacheMutation({ mutationFn: async () => ({ success: true as const, data: null }), invalidateKeys: [['balance']] })
  const { result } = renderHook(() => useBuy({ onSuccess: callback }), { wrapper })
  await act(async () => { await expect(result.current.mutateAsync(undefined)).resolves.toBeNull() })
  expect(callback).toHaveBeenCalledOnce()
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  log.mockRestore()
})
it('an old initial request cannot overwrite the authoritative post-operation balance', async () => {
  const { client } = harness()
  let resolveOld!: (n: number) => void
  const old = client.fetchQuery({ queryKey: ['balance'], queryFn: () => new Promise<number>(resolve => { resolveOld = resolve }) }).catch(() => undefined)
  await refreshQueries(client, [['balance']])
  await client.fetchQuery({ queryKey: ['balance'], queryFn: async () => 1500 })
  resolveOld(1000)
  await old
  expect(client.getQueryData(['balance'])).toBe(1500)
})
it('preserves stable codes and legacy error text', () => {
  expect(() => unwrapResult({ success: false, error: 'legacy' })).toThrow('legacy')
  expect(() => unwrapResult({ success: false, error: 'uncertain', code: 'UNKNOWN' })).toThrow(ActionError)
  try { unwrapResult({ success: false, error: 'uncertain', code: 'UNKNOWN' }) }
  catch (error) { expect((error as ActionError).code).toBe('UNKNOWN') }
})
