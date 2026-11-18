import { act, fireEvent, render, screen, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { UserDetailModal } from '@/modules/admin/components/UserDetailModal'
import { DevUserSwitcher } from '@/modules/dev-tools/components/DevUserSwitcher'
import type { DevUser } from '@/modules/dev-tools/types'

const { searchUsers } = vi.hoisted(() => ({ searchUsers: vi.fn() }))
vi.mock('@/modules/dev-tools/actions', () => ({ searchUsers, setImpersonation: vi.fn(), clearImpersonation: vi.fn() }))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(r => { resolve = r })
  return { promise, resolve }
}
const detail = (name: string) => ({ user: { first_name: name, last_name: 'User', total_coins: 20, email: name + '@example.invalid' }, transactions: [] })
const response = (name: string) => ({ ok: true, json: async () => detail(name) }) as Response
beforeEach(() => { vi.clearAllMocks() })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

it('does not show A after switching to B, aborts on close and starts fresh on reopen', async () => {
  const a = deferred<Response>(), b = deferred<Response>()
  const fetcher = vi.fn().mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise).mockResolvedValue(response('Reopened'))
  vi.stubGlobal('fetch', fetcher)
  const view = render(<UserDetailModal userId="a" onClose={() => {}} />)
  expect(screen.getByText('Загрузка...')).toBeTruthy()
  view.rerender(<UserDetailModal userId="b" onClose={() => {}} />)
  expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true)
  await act(async () => { b.resolve(response('B')) })
  expect(screen.getByText('User B')).toBeTruthy()
  await act(async () => { a.resolve(response('A')) })
  expect(screen.queryByText('User A')).toBeNull()
  view.rerender(<UserDetailModal userId={null} onClose={() => {}} />)
  expect(fetcher.mock.calls[1][1].signal.aborted).toBe(true)
  await act(async () => view.rerender(<UserDetailModal userId="b" onClose={() => {}} />))
  expect(screen.getByText('User Reopened')).toBeTruthy()
})

it.each(['http', 'network'])('handles user-detail %s failure without showing stale data', async failure => {
  vi.stubGlobal('fetch', failure === 'http' ? vi.fn().mockResolvedValue({ ok: false }) : vi.fn().mockRejectedValue(new Error('offline')))
  await act(async () => render(<UserDetailModal userId="a" onClose={() => {}} />))
  expect(screen.getByText('Не найден')).toBeTruthy()
  expect(screen.queryByText('Загрузка...')).toBeNull()
})

it('ignores a delayed JSON body after the modal has closed', async () => {
  const body = deferred<ReturnType<typeof detail>>()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => body.promise }))
  const view = render(<UserDetailModal userId="a" onClose={() => {}} />)
  await act(async () => {})
  view.rerender(<UserDetailModal userId={null} onClose={() => {}} />)
  await act(async () => body.resolve(detail('Late')))
  expect(view.container.textContent).toBe('')
})

const user = (name: string): DevUser => ({ id: name, email: name + '@example.invalid', firstName: name, lastName: '', fullName: name, department: null, departmentCode: null, team: null })

it('loads once on opening, debounces search, ignores late responses and resets on reopening', async () => {
  vi.useFakeTimers()
  const initial = deferred<DevUser[]>(), oldSearch = deferred<DevUser[]>(), latest = deferred<DevUser[]>()
  searchUsers.mockReturnValueOnce(initial.promise).mockReturnValueOnce(oldSearch.promise).mockReturnValueOnce(latest.promise).mockResolvedValue([])
  render(<DevUserSwitcher />)
  fireEvent.click(screen.getByRole('button', { name: /Сменить юзера/ }))
  await act(async () => vi.advanceTimersByTime(300))
  expect(searchUsers).toHaveBeenCalledTimes(1)
  const input = screen.getByPlaceholderText('Поиск по имени или email...')
  fireEvent.change(input, { target: { value: 'old' } })
  await act(async () => vi.advanceTimersByTime(300))
  fireEvent.change(input, { target: { value: 'new' } })
  await act(async () => vi.advanceTimersByTime(300))
  await act(async () => latest.resolve([user('Latest')]))
  await act(async () => { oldSearch.resolve([user('Old')]); initial.resolve([user('Initial')]) })
  expect(screen.getByText('Latest')).toBeTruthy()
  expect(screen.queryByText('Old')).toBeNull()
  expect(screen.queryByText('Initial')).toBeNull()
  fireEvent.click(screen.getByText('Сменить пользователя (DEV)').parentElement!.querySelector('button')!)
  fireEvent.click(screen.getByRole('button', { name: /Сменить юзера/ }))
  expect((screen.getByPlaceholderText('Поиск по имени или email...') as HTMLInputElement).value).toBe('')
  await act(async () => vi.advanceTimersByTime(300))
  expect(searchUsers).toHaveBeenCalledTimes(4)
})

it('finishes loading after a search rejection and ignores a result after closing', async () => {
  vi.useFakeTimers()
  const pending = deferred<DevUser[]>()
  searchUsers.mockRejectedValueOnce(new Error('offline')).mockReturnValueOnce(pending.promise)
  const view = render(<DevUserSwitcher />)
  fireEvent.click(screen.getByRole('button', { name: /Сменить юзера/ }))
  await act(async () => vi.advanceTimersByTime(300))
  expect(screen.getByText('Пользователи не найдены')).toBeTruthy()
  fireEvent.change(screen.getByPlaceholderText('Поиск по имени или email...'), { target: { value: 'new' } })
  await act(async () => vi.advanceTimersByTime(300))
  fireEvent.click(screen.getByText('Сменить пользователя (DEV)').parentElement!.querySelector('button')!)
  await act(async () => pending.resolve([user('Late')]))
  expect(screen.queryByText('Late')).toBeNull()
  view.unmount()
  expect(vi.getTimerCount()).toBe(0)
})
