import { beforeEach, afterEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  user: vi.fn(), admin: vi.fn(), single: vi.fn(), maybeSingle: vi.fn(),
  update: vi.fn(), from: vi.fn(), rpc: vi.fn(), revalidate: vi.fn(),
}))
vi.mock('@/modules/auth', () => ({ getCurrentUser: mocks.user }))
vi.mock('@/modules/admin/checkIsAdmin', () => ({ checkIsAdmin: mocks.admin }))
vi.mock('@/config/supabase', () => ({ createSupabaseAdminClient: () => ({ from: mocks.from, rpc: mocks.rpc }) }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate, updateTag: vi.fn() }))
vi.mock('@/modules/shop/queries', () => ({ balanceTag: (id: string) => 'balance:' + id }))
import { getRouletteSettingsAction, setRouletteEnabledAction } from '@/modules/roulette/actions'
import { getRouletteEnabled, getRouletteStats } from '@/modules/roulette/queries'
beforeEach(() => {
  vi.resetAllMocks()
  const chain = { update: mocks.update, eq: () => chain, select: () => chain, single: mocks.single, maybeSingle: mocks.maybeSingle }
  mocks.from.mockReturnValue(chain)
  mocks.update.mockReturnValue(chain)
  mocks.user.mockResolvedValue({ wsUserId: 'user', isImpersonating: false })
  mocks.admin.mockResolvedValue(true)
})
afterEach(() => vi.restoreAllMocks())
it('denies settings reads and writes to non-admins', async () => {
  mocks.admin.mockResolvedValue(false)
  expect(await getRouletteSettingsAction()).toMatchObject({ success: false })
  expect(await setRouletteEnabledAction({ enabled: true })).toMatchObject({ success: false })
  expect(mocks.from).not.toHaveBeenCalled()
})
it('denies changes while impersonating, even for an admin', async () => {
  mocks.user.mockResolvedValue({ isImpersonating: true })
  expect(await setRouletteEnabledAction({ enabled: false })).toMatchObject({ success: false })
  expect(mocks.update).not.toHaveBeenCalled()
})
it('rejects truthy strings rather than treating them as booleans', async () => {
  expect(await setRouletteEnabledAction({ enabled: 'false' })).toMatchObject({ success: false })
  expect(mocks.update).not.toHaveBeenCalled()
})
it('preserves a committed switch change when server navigation refresh fails', async () => {
  mocks.single.mockResolvedValue({ data: { enabled: false }, error: null })
  mocks.revalidate.mockImplementation(() => { throw new Error('refresh failed') })
  vi.spyOn(console, 'error').mockImplementation(() => {})
  expect(await setRouletteEnabledAction({ enabled: false })).toEqual({ success: true, data: false })
  expect(mocks.update).toHaveBeenCalledExactlyOnceWith({ enabled: false })
})
it('does not announce success when the settings write returns a database error', async () => {
  mocks.single.mockResolvedValue({ data: null, error: { message: 'DB error' } })
  expect(await setRouletteEnabledAction({ enabled: true })).toMatchObject({ success: false })
  expect(mocks.revalidate).not.toHaveBeenCalled()
})
it('distinguishes unavailable settings from the disabled switch', async () => {
  mocks.maybeSingle.mockResolvedValue({ data: null, error: { message: 'DB error' } })
  expect(await getRouletteEnabled()).toBeNull()
  expect(await getRouletteSettingsAction()).toMatchObject({ success: false })
  mocks.maybeSingle.mockResolvedValue({ data: { enabled: false }, error: null })
  expect(await getRouletteSettingsAction()).toEqual({ success: true, data: false })
})
it('fails closed when reading settings throws', async () => {
  mocks.maybeSingle.mockRejectedValue(new Error('network'))
  expect(await getRouletteEnabled()).toBeNull()
})
it('returns exact statistics including negative total delta and zero outcomes share', async () => {
  const data = { spins: 7, players: 7, bets: 7000, balancesAfter: 6850, delta: -150, zeroShare: 2 / 7 }
  mocks.rpc.mockResolvedValue({ data, error: null })
  expect(await getRouletteStats('2026-11-01', '2026-12-01')).toEqual(data)
  expect(mocks.rpc).toHaveBeenCalledWith('get_roulette_stats', { p_from: '2026-11-01', p_to: '2026-12-01' })
})
it.each([
  { data: null, error: { message: 'DB error' } },
  { data: { spins: 1 }, error: null },
  { data: { spins: 1, players: 1, bets: Number.MAX_SAFE_INTEGER + 1, balancesAfter: 0, delta: 0, zeroShare: 0 }, error: null },
])('rejects failed or invalid statistics instead of inventing zero totals', async response => {
  mocks.rpc.mockResolvedValue(response)
  await expect(getRouletteStats(null, null)).rejects.toThrow()
})

