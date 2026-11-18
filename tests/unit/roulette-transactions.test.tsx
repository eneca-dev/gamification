import { render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  from: vi.fn(), select: vi.fn(), eq: vi.fn(), order: vi.fn(), range: vi.fn(),
}))
vi.mock('@/config/supabase', () => ({ createSupabaseAdminClient: () => ({ from: mocks.from }) }))
vi.mock('@/lib/server-cache', () => ({ cached: (fn: () => unknown) => fn, CACHE_5M: 300 }))
import { getDashboardTransactions, getUserTransactions } from '@/modules/transactions/queries'
import { TransactionsList } from '@/modules/transactions/components/TransactionsList'
import { getEventIcon } from '@/modules/transactions/types'
const row = { transaction_id: 'transaction-1', event_date: '2026-11-18', created_at: '2026-11-18T12:00:00Z', event_type: 'roulette_spin', source: 'roulette', coins: -1000, description: 'Одна проводка на фактическую разницу', details: null }
beforeEach(() => {
  vi.clearAllMocks()
  mocks.from.mockReturnValue(mocks)
  mocks.select.mockReturnThis()
  mocks.eq.mockReturnThis()
  mocks.order.mockReturnThis()
  mocks.range.mockResolvedValue({ data: [row], error: null })
})
it.each([-1000, 50, 1000])('shows a clear roulette description without changing signed coins: %s', async coins => {
  mocks.range.mockResolvedValue({ data: [{ ...row, coins }], error: null })
  const history = await getUserTransactions('pilot@example.invalid')
  expect(history).toHaveLength(1)
  expect(history[0]).toMatchObject({ id: row.transaction_id, source: 'roulette', coins, description: 'Рулетка — результат хода' })
  const feed = await getDashboardTransactions('pilot@example.invalid')
  expect(feed).toHaveLength(1)
  expect(feed[0]).toMatchObject({ amount: coins, description: 'Рулетка — результат хода', icon: '🎡' })
  expect(mocks.from.mock.calls.every(([table]) => table === 'view_user_transactions')).toBe(true)
})
it('preserves descriptions for unrelated transaction types', async () => {
  mocks.range.mockResolvedValue({ data: [{ ...row, event_type: 'green_day', source: 'ws', description: 'Рабочий день', coins: 10 }], error: null })
  expect((await getDashboardTransactions('pilot@example.invalid'))[0]).toMatchObject({ description: 'Рабочий день', amount: 10, icon: '🟢' })
})
it('labels the roulette source in Russian in the transaction list', () => {
  render(<TransactionsList items={[{ id: 'transaction-1', event_type: 'roulette_spin', source: 'roulette', coins: -1000, description: 'Рулетка — результат хода', icon: getEventIcon('roulette_spin'), dateFormatted: '18 нояб.' }]} />)
  expect(screen.getAllByText('Рулетка')).toHaveLength(2) // Desktop and mobile source badges.
  expect(screen.queryByText('roulette')).toBeNull()
})
