import type { ReactElement, ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ user: vi.fn(), products: vi.fn(), balance: vi.fn(), enabled: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error('redirect:' + path) } }))
vi.mock('@/modules/auth', () => ({ getCurrentUser: mocks.user }))
vi.mock('@/modules/shop', () => ({ getProducts: mocks.products, getCategories: async () => [], getUserBalance: mocks.balance }))
vi.mock('@/modules/roulette', () => ({ getRouletteEnabled: mocks.enabled }))
vi.mock('@/modules/streak-shield', () => ({ getShieldQuota: async () => null, getShieldCredits: async () => ({ ws: 0, revit: 0 }) }))
vi.mock('@/modules/profile-appearance/queries', () => ({ bimoEnabled: () => false, getBimoState: async () => null }))
vi.mock('@/modules/profile-appearance/components/BimoShop', () => ({ BimoShop: () => null }))
vi.mock('@/modules/roulette/components/RoulettePanel', () => ({ RoulettePanel: () => null }))
vi.mock('@/modules/shop/components/StoreClient', () => ({ StoreClient: () => null }))
import StorePage from '@/app/(main)/store/page'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.enabled.mockResolvedValue(false)
  mocks.products.mockResolvedValue([])
})
it.each(['employee-id', null])('keeps the roulette route available with employee link %s even when the switch is off', async wsUserId => {
  mocks.user.mockResolvedValue({ wsUserId, email: 'not-the-pilot@example.invalid' })
  const page = await StorePage({ searchParams: Promise.resolve({ tab: 'roulette' }) })
  const store = page.props.children as ReactElement<{ activeTab: string; rouletteContent: ReactNode }>
  expect(store.props.activeTab).toBe('roulette')
  expect(store.props.rouletteContent).not.toBeNull()
  expect(mocks.enabled).not.toHaveBeenCalled()
  expect(mocks.products).not.toHaveBeenCalled()
  expect(mocks.balance).not.toHaveBeenCalled()
  if (!wsUserId) {
    render(store.props.rouletteContent)
    expect(screen.getByRole('heading', { name: 'Рулетка' })).toBeTruthy()
    expect(screen.getByText('Рулетка пока недоступна для этого аккаунта.')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  }
})
it('still redirects an unauthenticated visitor before reading store data', async () => {
  mocks.user.mockResolvedValue(null)
  await expect(StorePage({ searchParams: Promise.resolve({ tab: 'roulette' }) })).rejects.toThrow('redirect:/login')
  expect(mocks.products).not.toHaveBeenCalled()
  expect(mocks.balance).not.toHaveBeenCalled()
})
