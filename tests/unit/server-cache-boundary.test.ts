import { expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ tag: vi.fn(), path: vi.fn() }))
vi.mock('next/cache', () => ({ updateTag: mocks.tag, revalidatePath: mocks.path }))
vi.mock('@/modules/shop/queries', () => ({ balanceTag: (id: string) => 'balance:' + id }))
import { refreshBalanceAfterCommit } from '@/modules/shop/balance-cache'
it('continues independent path invalidation when balance tag expiration throws', () => {
  mocks.tag.mockImplementation(() => { throw new Error('cache failed') })
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  expect(() => refreshBalanceAfterCommit('u', ['/store', '/'])).not.toThrow()
  expect(mocks.path.mock.calls).toEqual([['/store'], ['/']])
  log.mockRestore()
})
