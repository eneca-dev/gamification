import { afterEach, expect, it, vi } from 'vitest'
import { canUseRoulettePilot } from '@/config/roulette'

afterEach(() => vi.unstubAllEnvs())
it.each(['', 'invalid', 'one@example.invalid,two@example.invalid', undefined])('fails closed for an absent or invalid account: %s', configured => {
  vi.stubEnv('ROULETTE_PILOT_EMAIL', configured)
  expect(canUseRoulettePilot({ email: 'one@example.invalid' })).toBe(false)
})
it('allows only the exact verified account, ignoring case and surrounding whitespace', () => {
  vi.stubEnv('ROULETTE_PILOT_EMAIL', ' Pilot@Example.invalid ')
  expect(canUseRoulettePilot({ email: 'pilot@example.invalid' })).toBe(true)
  expect(canUseRoulettePilot({ email: 'other@example.invalid' })).toBe(false)
  expect(canUseRoulettePilot({ email: 'pilot@example.invalid', isImpersonating: true })).toBe(false)
  expect(canUseRoulettePilot(null)).toBe(false)
})

