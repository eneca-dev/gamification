import { expect, it } from 'vitest'
import { eventSource, transactionMetrics } from '@/modules/admin/export/transaction-metrics'
it.each([
  [500, 'roulette', 0, 0], [-1000, 'roulette', 0, 1000],
  [200, null, 200, 0], [-30, null, 0, 30], [0, null, 0, 0],
  [50, 'ws', 50, 0], [-10, 'revit', 0, 10], [25, 'other', 25, 0],
] as const)('coins=%s source=%s', (coins, source, earned, spent) => {
  expect(transactionMetrics(coins, source)).toEqual({ earned, spent })
})
it('accepts a missing source but rejects a multiplied event join', () => {
  expect(eventSource(null)).toBeNull()
  expect(eventSource([])).toBeNull()
  expect(eventSource([{ source: 'roulette' }])).toBe('roulette')
  expect(() => eventSource([{ source: 'ws' }, { source: 'roulette' }])).toThrow()
})
