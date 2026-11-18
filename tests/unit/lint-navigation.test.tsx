import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { LayoutShell } from '@/components/LayoutShell'

const navigation = vi.hoisted(() => ({ pathname: '/' }))
vi.mock('next/navigation', () => ({ usePathname: () => navigation.pathname }))
vi.mock('@/modules/auth/index.client', () => ({ signOut: vi.fn() }))
vi.mock('@/modules/dev-tools/components/DevUserSwitcher', () => ({ DevUserSwitcher: () => null }))
vi.mock('@/components/CoinBalance', () => ({ CoinBalanceLive: () => null }))
vi.mock('@/modules/profile-appearance/components/BimoCompanion', () => ({ BimoCompanion: () => null }))
vi.mock('@/modules/feedback/components/FeedbackButton', () => ({ FeedbackButton: () => null }))
vi.mock('@/modules/chat/components/ChatWidget', () => ({ ChatWidget: () => null }))

beforeEach(() => { navigation.pathname = '/'; localStorage.clear(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-18T12:00:00Z')) })
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers() })
const key = 'day_off_last_seen_at'
const resolved = ['2026-11-17T10:00:00Z', '2026-11-17T11:00:00Z']
const link = () => screen.getByRole('link', { name: /Запросить выходной/ })

it('initializes first visit without unread badge and survives unavailable storage', () => {
  const view = render(<Sidebar user={null} balance={0} dayOffResolved={resolved} />)
  expect(localStorage.getItem(key)).toBeTruthy()
  expect(within(link()).queryByText('2')).toBeNull()
  view.unmount()
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
  expect(() => render(<Sidebar user={null} balance={0} dayOffResolved={resolved} />)).not.toThrow()
  expect(within(link()).queryByText('2')).toBeNull()
})

it('refreshes unread badge across tabs and marks visits to day-off as read', () => {
  localStorage.setItem(key, '2026-11-16T10:00:00Z')
  const view = render(<Sidebar user={null} balance={0} dayOffResolved={resolved} />)
  expect(within(link()).getByText('2')).toBeTruthy()
  act(() => {
    localStorage.setItem(key, '2026-11-17T10:30:00Z')
    window.dispatchEvent(new StorageEvent('storage', { key }))
  })
  expect(within(link()).getByText('1')).toBeTruthy()
  navigation.pathname = '/day-off'
  view.rerender(<Sidebar user={null} balance={0} dayOffResolved={resolved} />)
  expect(within(link()).queryByText('1')).toBeNull()
  navigation.pathname = '/store'
  view.rerender(<Sidebar user={null} balance={0} dayOffResolved={resolved} />)
  expect(within(link()).queryByText('1')).toBeNull()
})

function Draft() {
  const [text, setText] = useState('')
  return <input aria-label="draft" value={text} onChange={event => setText(event.target.value)} />
}
it('closes only the mobile menu on navigation, preserving child state', () => {
  const props = { user: null, balance: 0, showDevSwitcher: false, dayOffResolved: [], sidebarCollapsed: false }
  const view = render(<LayoutShell {...props}><Draft /></LayoutShell>)
  fireEvent.change(screen.getByLabelText('draft'), { target: { value: 'unsaved' } })
  fireEvent.click(screen.getByRole('button', { name: 'Открыть меню' }))
  expect(view.container.querySelector('aside')?.className).not.toContain('-translate-x-full')
  navigation.pathname = '/store'
  view.rerender(<LayoutShell {...props}><Draft /></LayoutShell>)
  expect(view.container.querySelector('aside')?.className).toContain('-translate-x-full')
  expect((screen.getByLabelText('draft') as HTMLInputElement).value).toBe('unsaved')
})
