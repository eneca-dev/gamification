import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { LotteryBanner } from '@/modules/lottery/components/LotteryBanner'
import { LotteryReveal } from '@/modules/lottery/components/LotteryReveal'
import type { LotteryWithStats } from '@/modules/lottery/types'

vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }))
vi.mock('@/modules/shop/index.client', () => ({ purchaseProduct: vi.fn() }))
vi.mock('@/components/CoinBalance', () => ({ CoinStatic: ({ amount }: { amount: number }) => <span>{amount}</span> }))
const lottery: LotteryWithStats = { id: 'one', name: 'Prize', description: null, image_url: null, ticket_price: 10, product_id: 'p', status: 'active', month: '2026-11-01', winner_user_id: null, drawn_at: null, created_by: 'a', created_at: '2026-11-01', total_tickets: 0, total_participants: 0 }
beforeEach(() => { localStorage.clear(); vi.useFakeTimers() })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks() })

it('renders server countdown despite incorrect client time, updates and stops at zero', () => {
  vi.setSystemTime(new Date('2030-01-01T00:00:00Z'))
  const serverTime = Date.parse('2026-12-01T08:59:58Z')
  const html = renderToString(<LotteryBanner lottery={lottery} balance={0} ticketInfo={null} serverTime={serverTime} />)
  expect(new DOMParser().parseFromString(html, 'text/html').body.textContent).toContain('00:00:02')
  const view = render(<LotteryBanner lottery={lottery} balance={0} ticketInfo={null} serverTime={serverTime} />)
  expect(screen.getByText(/00:00:02/)).toBeTruthy()
  act(() => vi.advanceTimersByTime(1000))
  expect(screen.getByText(/00:00:01/)).toBeTruthy()
  act(() => vi.advanceTimersByTime(1000))
  expect(screen.getByText(/00:00:00/)).toBeTruthy()
  expect(vi.getTimerCount()).toBe(0)
  view.rerender(<LotteryBanner lottery={lottery} balance={0} ticketInfo={null} serverTime={serverTime - 5000} />)
  expect(screen.getByText(/00:00:07/)).toBeTruthy()
  view.unmount()
  expect(vi.getTimerCount()).toBe(0)
})

it('does not reveal seen results and initializes a new lottery without stale phase', () => {
  localStorage.setItem('lottery_revealed_one', '1')
  expect(renderToString(<LotteryReveal lottery={lottery} wasParticipant />)).toBe('')
  const view = render(<LotteryReveal lottery={lottery} wasParticipant />)
  expect(screen.queryByText('Открыть конверт')).toBeNull()
  view.rerender(<LotteryReveal lottery={{ ...lottery, id: 'two' }} wasParticipant />)
  fireEvent.click(screen.getByText('Открыть конверт'))
  act(() => vi.advanceTimersByTime(1500))
  expect(localStorage.getItem('lottery_revealed_two')).toBe('1')
  view.rerender(<LotteryReveal lottery={{ ...lottery, id: 'three' }} wasParticipant />)
  expect(screen.getByText('Открыть конверт')).toBeTruthy()
  fireEvent.click(screen.getByText('Открыть конверт'))
  view.unmount()
  act(() => vi.advanceTimersByTime(2000))
  expect(localStorage.getItem('lottery_revealed_three')).toBeNull()
})

it('handles disabled storage and excludes nonparticipants', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
  const view = render(<LotteryReveal lottery={lottery} wasParticipant={false} />)
  expect(screen.queryByText('Открыть конверт')).toBeNull()
  view.rerender(<LotteryReveal lottery={lottery} wasParticipant />)
  fireEvent.click(screen.getByText('Открыть конверт'))
  expect(() => act(() => vi.advanceTimersByTime(1500))).not.toThrow()
})
