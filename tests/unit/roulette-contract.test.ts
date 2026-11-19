import { describe, expect, it } from 'vitest'
import { spinResultSchema } from '@/modules/roulette/types'

const base = { operationId: '12345678-1234-4123-8123-123456789012', period: '2026-11', balanceBefore: 1000, completedAt: '2026-11-17T10:00:00Z' }
describe('roulette economics (independent expected values)', () => {
  it.each([
    ['x2', 2000, 1000], ['plus500', 1500, 500], ['plus200', 1200, 200],
    ['plus100', 1100, 100], ['plus50', 1050, 50], ['zero1', 0, -1000], ['zero2', 0, -1000],
  ])('%s validates its saved ledger result', (sector, balanceAfter, delta) => {
    expect(spinResultSchema.safeParse({ ...base, sector, balanceAfter, delta }).success).toBe(true)
  })
  it.each([
    { balanceAfter: 2001, delta: 1000 }, { balanceAfter: 2000, delta: 999 },
    { balanceAfter: 0, delta: -1000 }, { balanceBefore: 0, balanceAfter: 0, delta: 0 },
    { balanceAfter: '2000', delta: 1000 }, { balanceBefore: 2147483647, balanceAfter: 4294967294, delta: 2147483647 },
  ])('rejects malformed or inconsistent database data: %j', fields => {
    expect(spinResultSchema.safeParse({ ...base, sector: 'x2', ...fields }).success).toBe(false)
  })
})
