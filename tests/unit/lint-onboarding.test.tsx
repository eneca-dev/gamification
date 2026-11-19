import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { OnboardingProvider, useOnboardingContext } from '@/modules/onboarding/components/OnboardingProvider'

const router = vi.hoisted(() => ({ push: vi.fn() }))
const search = new URLSearchParams()
vi.mock('next/navigation', () => ({ useRouter: () => router, usePathname: () => '/unknown', useSearchParams: () => search }))
vi.mock('@/modules/onboarding/actions', () => ({ getOnboardingSeenSlugs: async () => [], markTourSeenInDb: vi.fn() }))
vi.mock('@/modules/onboarding/components/OnboardingDevPanel', () => ({ OnboardingDevPanel: () => null }))
vi.mock('@/modules/onboarding/tours/dashboard', () => ({ dashboardTour: { pageSlug: 'dashboard', steps: [
  { id: 'same', target: null, title: 'Intro', description: '', placement: 'center' },
  { id: 'target', target: 'fixture', title: 'Target', description: '', placement: 'bottom' },
  { id: 'end', target: null, title: 'End', description: '', placement: 'center' },
] } }))
vi.mock('@/modules/onboarding/tours/store', () => ({ storeTour: { pageSlug: 'store', steps: [
  { id: 'same', target: 'missing', title: 'Other tour', description: '', placement: 'bottom' },
] } }))

function Controls() {
  const { startTour } = useOnboardingContext()
  return <><button onClick={() => startTour('dashboard')}>Start</button><button onClick={() => startTour('dashboard', 1)}>Target step</button><button onClick={() => startTour('store')}>Other</button><div data-onboarding="fixture">Fixture</div></>
}
beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  document.body.style.overflow = 'auto'
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); document.body.style.overflow = '' })

it('resets between modal and target steps and on revisiting; restores body overflow', async () => {
  const view = render(<OnboardingProvider userId="fixture"><Controls /></OnboardingProvider>)
  await act(async () => {})
  fireEvent.click(screen.getByText('Start'))
  expect(screen.getByText('Intro')).toBeTruthy()
  expect(document.body.style.overflow).toBe('hidden')
  fireEvent.click(screen.getByText('Далее'))
  expect(screen.queryByText('Intro')).toBeNull()
  expect(screen.queryByText('Target')).toBeNull()
  act(() => vi.advanceTimersByTime(200))
  act(() => vi.advanceTimersByTime(600))
  expect(screen.getByText('Target')).toBeTruthy()
  fireEvent.click(screen.getByText('Далее'))
  expect(screen.getByText('End')).toBeTruthy()
  fireEvent.click(screen.getByText('Target step'))
  expect(screen.queryByText('End')).toBeNull()
  expect(screen.queryByText('Target')).toBeNull()
  view.unmount()
  act(() => vi.advanceTimersByTime(5000))
  expect(document.body.style.overflow).toBe('auto')
  expect(vi.getTimerCount()).toBe(0)
})

it('does not retain ready state for another tour with the same step id; skips missing target', async () => {
  render(<OnboardingProvider userId="fixture"><Controls /></OnboardingProvider>)
  await act(async () => {})
  fireEvent.click(screen.getByText('Start'))
  fireEvent.click(screen.getByText('Other'))
  expect(screen.queryByText('Intro')).toBeNull()
  expect(screen.queryByText('Other tour')).toBeNull()
  act(() => vi.advanceTimersByTime(3400))
  expect(document.body.style.overflow).toBe('auto')
})
