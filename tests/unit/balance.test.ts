import { beforeEach, expect, it, vi } from 'vitest'
const { maybeSingle } = vi.hoisted(() => ({ maybeSingle: vi.fn() }))
vi.mock('@/config/supabase', () => ({ createSupabaseAdminClient: () => ({
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
}) }))
import { readUserBalance } from '@/modules/shop/balance'
beforeEach(() => vi.clearAllMocks())
it('only a successfully missing row is zero', async () => {
  maybeSingle.mockResolvedValue({ data: null, error: null })
  await expect(readUserBalance('new-user')).resolves.toBe(0)
})
it('never turns a database failure into zero', async () => {
  maybeSingle.mockResolvedValue({ data: null, error: { message: 'offline' } })
  await expect(readUserBalance('user')).rejects.toThrow()
})
it.each([null, '1000', undefined, NaN, 1.5])('rejects malformed balances: %s', total_coins => {
  maybeSingle.mockResolvedValue({ data: { total_coins }, error: null })
  return expect(readUserBalance('user')).rejects.toThrow()
})
it.each([0, -20, 1500])('preserves valid balance %i', total_coins => {
  maybeSingle.mockResolvedValue({ data: { total_coins }, error: null })
  return expect(readUserBalance('user')).resolves.toBe(total_coins)
})
