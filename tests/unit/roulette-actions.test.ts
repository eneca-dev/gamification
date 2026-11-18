import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(), user: vi.fn(), updateTag: vi.fn(), readBalance: vi.fn(),
}))
vi.mock('@/config/supabase', () => ({ createSupabaseAdminClient: () => ({ rpc: mocks.rpc }) }))
vi.mock('@/modules/auth', () => ({ getCurrentUser: mocks.user }))
vi.mock('@/modules/admin/checkIsAdmin', () => ({ checkIsAdmin: async () => true }))
vi.mock('@/modules/shop/balance', () => ({ readUserBalance: mocks.readBalance }))
vi.mock('@/modules/shop/queries', () => ({ balanceTag: (id: string) => 'balance:' + id }))
vi.mock('next/cache', () => ({ updateTag: mocks.updateTag, revalidatePath: vi.fn() }))
import { signConfirmation } from '@/modules/roulette/confirmation'
import { recoverRouletteAction, spinRouletteAction } from '@/modules/roulette/actions'

const userId = '12345678-1234-4123-8123-123456789012'
const operationId = '22345678-1234-4123-8123-123456789012'
const result = { operationId, period: '2026-11', sector: 'plus500', balanceBefore: 1000, balanceAfter: 1500, delta: 500, completedAt: '2026-11-17T10:00:00Z' }
const token = () => signConfirmation({ purpose: 'roulette-confirmation-v1', userId, operationId, period: '2026-11', balance: 1000 })
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('ROULETTE_PILOT_EMAIL', 'pilot@example.invalid')
  vi.stubEnv('ROULETTE_CONFIRMATION_SECRET', 'test-only-signing-key-at-least-32-bytes')
  mocks.user.mockResolvedValue({ email: 'pilot@example.invalid', wsUserId: userId, isImpersonating: false })
  mocks.updateTag.mockImplementation(() => {})
})
afterEach(() => vi.unstubAllEnvs())
it('rejects impersonation before the financial RPC', async () => {
  mocks.user.mockResolvedValue({ email: 'pilot@example.invalid', wsUserId: userId, isImpersonating: true })
  expect(await spinRouletteAction({ token: token() })).toMatchObject({ success: false, code: 'IMPERSONATION' })
  expect(mocks.rpc).not.toHaveBeenCalled()
})
it('returns a committed result even when server cache expiration fails', async () => {
  mocks.rpc.mockResolvedValue({ data: { result, replayed: false }, error: null })
  mocks.updateTag.mockImplementation(() => { throw new Error('cache') })
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  expect(await spinRouletteAction({ token: token() })).toEqual({ success: true, data: { result, replayed: false } })
  log.mockRestore()
})
it('treats a different starting balance in a new SQL response as unknown', async () => {
  mocks.rpc.mockResolvedValue({ data: { result: { ...result, balanceBefore: 500, balanceAfter: 1000 }, replayed: false }, error: null })
  expect(await spinRouletteAction({ token: token() })).toMatchObject({ success: false, code: 'ROULETTE_UNKNOWN' })
})
it('accepts another tab canonical replay without replacing the current balance with history', async () => {
  const canonical = { ...result, operationId: userId, balanceBefore: 500, balanceAfter: 1000 }
  mocks.rpc.mockResolvedValue({ data: { result: canonical, replayed: true }, error: null })
  expect(await spinRouletteAction({ token: token() })).toMatchObject({ success: true, data: { result: canonical } })
  expect(mocks.readBalance).not.toHaveBeenCalled()
  expect(mocks.updateTag).toHaveBeenCalledWith('balance:' + userId)
})
it.each([
  { data: null, error: { code: 'PGRST500', message: 'upstream failed' } },
  { data: { malformed: true }, error: null },
  { data: null, error: { code: 'P0001', message: 'roulette_corrupt_result' } },
])('does not infer failure from a lost/invalid SQL response', async response => {
  mocks.rpc.mockResolvedValue(response)
  expect(await spinRouletteAction({ token: token() })).toMatchObject({ success: false, code: 'ROULETTE_UNKNOWN' })
})
it('recovers the original period with no signing secret and expires current balance independently', async () => {
  vi.stubEnv('ROULETTE_CONFIRMATION_SECRET', '')
  mocks.rpc.mockResolvedValue({ data: result, error: null })
  expect(await recoverRouletteAction({ period: '2026-11' })).toEqual({ success: true, data: result })
  expect(mocks.rpc).toHaveBeenCalledWith('get_roulette_result', { p_user_id: userId, p_period: '2026-11' })
})

it('rejects unauthenticated state, preparation, spin and recovery without RPC', async () => {
  mocks.user.mockResolvedValue(null)
  const { getRouletteStateAction, prepareRouletteAction } = await import('@/modules/roulette/actions')
  for (const response of await Promise.all([getRouletteStateAction(), prepareRouletteAction(), spinRouletteAction({ token: token() }), recoverRouletteAction({ period: '2026-11' })])) {
    expect(response).toMatchObject({ success: false, code: 'UNAUTHORIZED' })
  }
  expect(mocks.rpc).not.toHaveBeenCalled()
})
it.each([
  { data: { enabled: false, period: '2026-11', result: null }, code: 'roulette_disabled' },
  { data: { enabled: true, period: '2026-11', result }, code: 'ALREADY_PLAYED' },
  { data: { enabled: true, period: 'bad', result: null }, code: 'ROULETTE_UNAVAILABLE' },
])('does not read a stake when preparation is rejected: $code', async ({ data, code }) => {
  const { prepareRouletteAction } = await import('@/modules/roulette/actions')
  mocks.rpc.mockResolvedValue({ data, error: null })
  expect(await prepareRouletteAction()).toMatchObject({ success: false, code })
  expect(mocks.readBalance).not.toHaveBeenCalled()
})
it('signs the successfully read balance and database period without submitting a spin', async () => {
  const { prepareRouletteAction } = await import('@/modules/roulette/actions')
  const { verifyConfirmation } = await import('@/modules/roulette/confirmation')
  mocks.rpc.mockResolvedValue({ data: { enabled: true, period: '2026-11', result: null }, error: null })
  mocks.readBalance.mockResolvedValue(735)
  const prepared = await prepareRouletteAction()
  expect(prepared.success).toBe(true)
  if (!prepared.success) throw new Error('Preparation failed')
  expect(verifyConfirmation(prepared.data.token, userId)).toMatchObject({ balance: 735, period: '2026-11', operationId: prepared.data.operationId })
  expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('get_roulette_state', { p_user_id: userId })
})
it.each([0, -10])('does not prepare a nonpositive balance: %s', async balance => {
  const { prepareRouletteAction } = await import('@/modules/roulette/actions')
  mocks.rpc.mockResolvedValue({ data: { enabled: true, period: '2026-11', result: null }, error: null })
  mocks.readBalance.mockResolvedValue(balance)
  expect(await prepareRouletteAction()).toMatchObject({ success: false, code: 'roulette_no_balance' })
})
it('does not convert a balance read failure into a zero balance', async () => {
  const { prepareRouletteAction } = await import('@/modules/roulette/actions')
  mocks.rpc.mockResolvedValue({ data: { enabled: true, period: '2026-11', result: null }, error: null })
  mocks.readBalance.mockRejectedValue(new Error('database unavailable'))
  expect(await prepareRouletteAction()).toMatchObject({ success: false, code: 'CONFIRMATION_UNAVAILABLE' })
})
it.each(['roulette_balance_changed', 'roulette_period_changed', 'roulette_disabled', 'roulette_no_balance', 'roulette_numeric_limit'])('preserves an explicit database rejection: %s', async code => {
  mocks.rpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: code } })
  expect(await spinRouletteAction({ token: token() })).toMatchObject({ success: false, code })
})
it('treats a thrown network error after send as unknown', async () => {
  mocks.rpc.mockRejectedValue(new Error('connection reset'))
  expect(await spinRouletteAction({ token: token() })).toMatchObject({ success: false, code: 'ROULETTE_UNKNOWN' })
})
it('rejects an unsigned token before submitting to the database', async () => {
  expect(await spinRouletteAction({ token: 'tampered' })).toMatchObject({ success: false, code: 'roulette_invalid_request' })
  expect(mocks.rpc).not.toHaveBeenCalled()
})
it('does not recover a result from a different period', async () => {
  mocks.rpc.mockResolvedValue({ data: { ...result, period: '2026-10' }, error: null })
  expect(await recoverRouletteAction({ period: '2026-11' })).toMatchObject({ success: false, code: 'ROULETTE_UNKNOWN' })
})


// Пилотный допуск по почте снят: доступ открывает переключатель админки.
// Остаётся запрет хода из-под подмены пользователя — он проверяется до любого
// финансового RPC, иначе администратор прокрутил бы чужой баланс.
it('blocks preparation and direct spin before any financial RPC while impersonating', async () => {
  mocks.user.mockResolvedValue({ email: 'pilot@example.invalid', wsUserId: userId, isImpersonating: true })
  const { prepareRouletteAction } = await import('@/modules/roulette/actions')
  expect(await prepareRouletteAction()).toMatchObject({ success: false, code: 'IMPERSONATION' })
  expect(await spinRouletteAction({ token: token() })).toMatchObject({ success: false, code: 'IMPERSONATION' })
  expect(mocks.rpc).not.toHaveBeenCalled()
})
it('masks the enabled flag while impersonating but retains recovery of an own past spin', async () => {
  mocks.user.mockResolvedValue({ email: 'pilot@example.invalid', wsUserId: userId, isImpersonating: true })
  const { getRouletteStateAction } = await import('@/modules/roulette/actions')
  mocks.rpc.mockResolvedValue({ data: { enabled: true, period: '2026-11', result }, error: null })
  expect(await getRouletteStateAction()).toMatchObject({ success: true, data: { enabled: false, result } })
  mocks.rpc.mockResolvedValue({ data: result, error: null })
  expect(await recoverRouletteAction({ period: '2026-11' })).toEqual({ success: true, data: result })
})

