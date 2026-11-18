import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { type ReactNode } from 'react'
const actions = vi.hoisted(() => ({
  state: vi.fn(), prepare: vi.fn(), spin: vi.fn(), recover: vi.fn(),
  balance: vi.fn(), settings: vi.fn(), toggle: vi.fn(), refresh: vi.fn(),
}))
vi.mock('@/modules/roulette/actions', () => ({
  getRouletteStateAction: actions.state, prepareRouletteAction: actions.prepare,
  spinRouletteAction: actions.spin, recoverRouletteAction: actions.recover,
  getRouletteSettingsAction: actions.settings, setRouletteEnabledAction: actions.toggle,
}))
vi.mock('@/modules/shop/index.client', () => ({ getBalanceAction: actions.balance }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: actions.refresh }) }))
vi.mock('framer-motion', async importOriginal => {
  const actual = await importOriginal<typeof import('framer-motion')>()
  return { ...actual, useReducedMotion: () => true }
})
import { RoulettePanel } from '@/modules/roulette/components/RoulettePanel'
import { RouletteAdmin } from '@/modules/roulette/components/RouletteAdmin'
import { savePendingSpin } from '@/modules/roulette/pending'
import { queryKeys } from '@/modules/cache'

const userId = '12345678-1234-4123-8123-123456789012'
const confirmation = { token: 'signed-original-token', operationId: '22345678-1234-4123-8123-123456789012', period: '2026-10', balance: 1000 }
const historical = { operationId: confirmation.operationId, period: confirmation.period, sector: 'plus500', balanceBefore: 1000, balanceAfter: 1500, delta: 500, completedAt: '2026-10-31T20:59:59Z' }
const clients: QueryClient[] = []
const success = <T,>(data: T) => ({ success: true as const, data })
function mount(child: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } })
  clients.push(client)
  return { client, ...render(<QueryClientProvider client={client}>{child}</QueryClientProvider>) }
}
function currentBalance() { return screen.getByText(/^Текущий баланс:/).textContent?.replace(/\s/g, '') }
beforeEach(() => {
  vi.resetAllMocks()
  localStorage.clear()
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', '') } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open') } })
  actions.state.mockResolvedValue(success({ enabled: true, period: '2026-11', result: null }))
  actions.balance.mockResolvedValue(success(1000))
  actions.prepare.mockResolvedValue(success(confirmation))
  actions.settings.mockResolvedValue(success(true))
})
afterEach(() => {
  clients.splice(0).forEach(client => client.clear())
  vi.restoreAllMocks()
})
it('shows seven equal odds and risk; cancellation never sends a spin', async () => {
  mount(<RoulettePanel userId={userId} isImpersonating={false} />)
  await waitFor(() => expect((screen.getByRole('button', { name: 'Поставить весь баланс' }) as HTMLButtonElement).disabled).toBe(false))
  expect(within(screen.getByRole('list', { name: 'Исходы и вероятности' })).getAllByRole('listitem')).toHaveLength(7)
  fireEvent.click(screen.getByRole('button', { name: 'Поставить весь баланс' }))
  const dialog = await screen.findByRole('dialog')
  expect(dialog.textContent).toContain('28,57%')
  expect(dialog.textContent).toContain('2026-10')
  expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Отмена' }))
  fireEvent.click(within(dialog).getByRole('button', { name: 'Отмена' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(actions.spin).not.toHaveBeenCalled()
})
it('recovers a lost response after remount using the original period and displays fresh balance separately', async () => {
  actions.spin.mockResolvedValue({ success: false, error: 'Результат пока неизвестен', code: 'ROULETTE_UNKNOWN' })
  const first = mount(<RoulettePanel userId={userId} isImpersonating={false} />)
  await waitFor(() => expect((screen.getByRole('button', { name: 'Поставить весь баланс' }) as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('button', { name: 'Поставить весь баланс' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Подтверждаю ставку' }))
  await screen.findByText('Результат пока неизвестен')
  expect(actions.spin).toHaveBeenCalledOnce()
  expect(actions.spin).toHaveBeenCalledWith({ token: confirmation.token })
  expect(Object.keys(localStorage).some(key => key.includes(confirmation.operationId))).toBe(true)
  first.unmount()
  actions.state.mockResolvedValue(success({ enabled: false, period: '2026-11', result: null }))
  actions.recover.mockResolvedValue(success(historical))
  actions.balance.mockResolvedValue(success(1700))
  mount(<RoulettePanel userId={userId} isImpersonating={false} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Восстановить результат' }))
  await screen.findByText('Результат восстановлен')
  expect(actions.recover).toHaveBeenCalledWith({ period: '2026-10' })
  await waitFor(() => expect(currentBalance()).toContain('1700'))
  expect(screen.getByText(/Баланс сразу после того хода:/).textContent?.replace(/\s/g, '')).toContain('1500')
  expect(Object.keys(localStorage).some(key => key.includes(confirmation.operationId))).toBe(false)
  expect(actions.spin).toHaveBeenCalledOnce()
})
it('keeps the committed result when refreshing balance fails and never retries the spin', async () => {
  actions.prepare.mockResolvedValue(success({ ...confirmation, period: '2026-11' }))
  actions.spin.mockImplementation(async () => {
    actions.balance.mockResolvedValue({ success: false, error: 'balance offline', code: 'BALANCE_UNAVAILABLE' })
    return success({ result: { ...historical, period: '2026-11' }, replayed: false })
  })
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  mount(<RoulettePanel userId={userId} isImpersonating={false} />)
  await waitFor(() => expect((screen.getByRole('button', { name: 'Поставить весь баланс' }) as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('button', { name: 'Поставить весь баланс' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Подтверждаю ставку' }))
  await screen.findByText('Результат за 2026-11: +500')
  await waitFor(() => expect(currentBalance()).toContain('Неудалосьобновить'))
  expect(currentBalance()).not.toMatch(/1000|1500/)
  fireEvent.click(screen.getByRole('button', { name: 'Обновить баланс' }))
  await waitFor(() => expect(actions.balance.mock.calls.length).toBeGreaterThan(2))
  expect(actions.spin).toHaveBeenCalledOnce()
  log.mockRestore()
})
it('does not send when the pending identity cannot be persisted', async () => {
  mount(<RoulettePanel userId={userId} isImpersonating={false} />)
  await waitFor(() => expect((screen.getByRole('button', { name: 'Поставить весь баланс' }) as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('button', { name: 'Поставить весь баланс' }))
  const confirm = await screen.findByRole('button', { name: 'Подтверждаю ставку' })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('storage denied') })
  fireEvent.click(confirm)
  await screen.findByText(/Не удалось сохранить идентификатор/)
  expect(actions.spin).not.toHaveBeenCalled()
})
it('allows recovery during impersonation but forbids sending the pending request', async () => {
  savePendingSpin(userId, confirmation)
  mount(<RoulettePanel userId={userId} isImpersonating />)
  expect((screen.getByRole('button', { name: 'Повторить прежний запрос' }) as HTMLButtonElement).disabled).toBe(true)
  expect((screen.getByRole('button', { name: 'Восстановить результат' }) as HTMLButtonElement).disabled).toBe(false)
  expect(actions.spin).not.toHaveBeenCalled()
})
it('keeps unknown pending identity when recovery returns no row', async () => {
  savePendingSpin(userId, confirmation)
  actions.recover.mockResolvedValue(success(null))
  mount(<RoulettePanel userId={userId} isImpersonating={false} />)
  fireEvent.click(screen.getByRole('button', { name: 'Восстановить результат' }))
  await screen.findByText(/Результат пока не найден/)
  expect(Object.keys(localStorage).some(key => key.includes(confirmation.operationId))).toBe(true)
  expect(screen.queryByRole('button', { name: 'Поставить весь баланс' })).toBeNull()
  expect(actions.spin).not.toHaveBeenCalled()
})
it('does not present a failed balance read as zero or enable a new bet', async () => {
  actions.balance.mockResolvedValue({ success: false, error: 'offline' })
  mount(<RoulettePanel userId={userId} isImpersonating={false} />)
  await screen.findByText('Не удалось обновить')
  expect((screen.getByRole('button', { name: 'Поставить весь баланс' }) as HTMLButtonElement).disabled).toBe(true)
  expect(currentBalance()).not.toMatch(/\d/)
})
it('uses authoritative settings after toggle and keeps control available when statistics fail', async () => {
  const { client } = mount(<RouletteAdmin enabled={true} stats={null} />)
  await waitFor(() => expect((screen.getByRole('switch') as HTMLButtonElement).disabled).toBe(false))
  expect(screen.queryByText(/Управление рулеткой пока недоступно/)).toBeNull()
  actions.toggle.mockImplementation(async () => {
    actions.settings.mockResolvedValue(success(false))
    return success(false)
  })
  fireEvent.click(screen.getByRole('switch'))
  await waitFor(() => expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false'))
  actions.settings.mockResolvedValue(success(true))
  await act(async () => { await client.invalidateQueries({ queryKey: [...queryKeys.roulette.all, 'settings'] }) })
  await waitFor(() => expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true'))
  expect(actions.toggle).toHaveBeenCalledExactlyOnceWith({ enabled: false })
})

