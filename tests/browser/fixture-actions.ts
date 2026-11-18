import type { ActionResult } from '@/modules/cache/types'
import type { Confirmation, RouletteState, SpinResponse, SpinResult } from '@/modules/roulette/types'

export const fixtureUser = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const period = '2026-11'
const params = new URLSearchParams(location.search)
export const scenario = params.get('scenario') ?? 'ready'
const outcomes = {
  x2: 2000, plus500: 1500, plus200: 1200, plus100: 1100, plus50: 1050, zero1: 0, zero2: 0,
} as const
const requestedSector = params.get('sector') ?? 'plus500'
const sector = Object.hasOwn(outcomes, requestedSector) ? requestedSector as SpinResult['sector'] : 'plus500'
const storageKey = 'synthetic-server:' + scenario + ':' + sector
interface FixtureRecord { result: SpinResult; balance: number }
const saved = localStorage.getItem(storageKey)
let record: FixtureRecord | null = saved ? JSON.parse(saved) as FixtureRecord : null
let releaseBalance: (() => void) | undefined
export const fixture = {
  spins: [] as string[],
  recoveries: [] as string[],
  failBalance: scenario === 'balance-error',
  holdNextBalance: false,
  heldReadsCompleted: 0,
  releaseBalance: () => releaseBalance?.(),
  setCurrentBalance: (balance: number) => {
    if (!record) throw new Error('Synthetic spin must exist first')
    record.balance = balance
    localStorage.setItem(storageKey, JSON.stringify(record))
  },
}
const ok = <T,>(data: T): ActionResult<T> => ({ success: true, data })

export async function getBalanceAction(): Promise<ActionResult<number>> {
  const value = record?.balance ?? (scenario === 'zero' ? 0 : 1000)
  if (fixture.holdNextBalance || scenario === 'loading') {
    fixture.holdNextBalance = false
    await new Promise<void>(resolve => { releaseBalance = resolve })
    fixture.heldReadsCompleted++
  }
  return fixture.failBalance ? { success: false, error: 'Synthetic balance read failed' } : ok(value)
}
export async function getRouletteStateAction(): Promise<ActionResult<RouletteState>> {
  if (scenario === 'state-error') return { success: false, error: 'Synthetic state read failed' }
  return ok({ enabled: scenario !== 'disabled', period, result: record?.result ?? null })
}
export async function prepareRouletteAction(): Promise<ActionResult<Confirmation>> {
  return ok({ token: 'synthetic-only-token', operationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', period, balance: 1000 })
}
export async function spinRouletteAction(input: { token: string }): Promise<ActionResult<SpinResponse>> {
  fixture.spins.push(input.token)
  if (record) return ok({ result: record.result, replayed: true })
  const result: SpinResult = {
    operationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', period, sector,
    balanceBefore: 1000, balanceAfter: outcomes[sector], delta: outcomes[sector] - 1000,
    completedAt: '2026-11-18T10:00:00Z',
  }
  record = { result, balance: outcomes[sector] + (scenario === 'lost-response' ? 37 : 0) }
  localStorage.setItem(storageKey, JSON.stringify(record))
  if (scenario === 'balance-after-error') fixture.failBalance = true
  if (scenario === 'lost-response') return { success: false, code: 'roulette_unknown', error: 'Ответ потерян. Восстановите прежний ход.' }
  return ok({ result, replayed: false })
}
export async function recoverRouletteAction(input: { period: string }): Promise<ActionResult<SpinResult | null>> {
  fixture.recoveries.push(input.period)
  return ok(record?.result.period === input.period ? record.result : null)
}
