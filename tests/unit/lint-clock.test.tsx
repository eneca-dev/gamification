import { act, renderHook, render, screen, cleanup } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, expect, it, vi } from 'vitest'
import { useUiClock } from '@/hooks/useUiClock'
import { CrystalRateStats } from '@/modules/admin/components/CrystalRateStats'
import { StrictMode } from 'react'

afterEach(() => { cleanup(); vi.useRealTimers() })

it('shares one clock, advances without parent rendering and stops after the last subscriber', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-18T12:00:00Z'))
  const first = renderHook(useUiClock)
  const second = renderHook(useUiClock)
  expect(first.result.current).toBe(1795003200000)
  expect(vi.getTimerCount()).toBe(1)
  act(() => vi.advanceTimersByTime(60_000))
  expect(second.result.current).toBe(1795003260000)
  first.unmount()
  expect(vi.getTimerCount()).toBe(1)
  second.unmount()
  expect(vi.getTimerCount()).toBe(0)
})

it('resubscribes correctly in StrictMode and reads fresh time on remount', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-18T12:00:00Z'))
  const first = renderHook(useUiClock, { wrapper: StrictMode })
  expect(first.result.current).toBe(1795003200000)
  expect(vi.getTimerCount()).toBe(1)
  first.unmount()
  vi.setSystemTime(new Date('2026-11-19T12:00:00Z'))
  const second = renderHook(useUiClock, { wrapper: StrictMode })
  expect(second.result.current).toBe(1795089600000)
  expect(vi.getTimerCount()).toBe(1)
})

const stats = { total: 0, active: 0, comingSoon: 0, inactive: 0, categoriesTotal: 0, withDiscount: 0, outOfStock: 0, avgPrice: 0, maxPrice: 0 }

it('renders no guessed age on the server and handles future dates and day rollover', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-18T12:00:00Z'))
  expect(renderToString(<CrystalRateStats stats={stats} ratedAt="2026-11-19T12:00:00Z" />)).not.toContain('без изменений курса')
  const view = render(<CrystalRateStats stats={stats} ratedAt="2026-11-19T12:00:00Z" />)
  expect(screen.getByText('дней без изменений курса').previousElementSibling?.textContent).toBe('0')
  view.rerender(<CrystalRateStats stats={stats} ratedAt="2026-11-17T12:00:30Z" />)
  act(() => vi.advanceTimersByTime(60_000))
  expect(screen.getByText('день без изменений курса').previousElementSibling?.textContent).toBe('1')
})
