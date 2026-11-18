import { afterEach, describe, expect, it, vi } from 'vitest'
import { signConfirmation, verifyConfirmation } from '@/modules/roulette/confirmation'

const payload = { purpose: 'roulette-confirmation-v1' as const, userId: '12345678-1234-4123-8123-123456789012', operationId: '22345678-1234-4123-8123-123456789012', period: '2026-11', balance: 1000 }
afterEach(() => vi.unstubAllEnvs())
describe('signed balance confirmation', () => {
  it('binds user, period, amount and original operation', () => {
    vi.stubEnv('ROULETTE_CONFIRMATION_SECRET', 'test-only-key-with-at-least-32-bytes')
    const token = signConfirmation(payload)
    expect(verifyConfirmation(token, payload.userId)).toEqual(payload)
    expect(verifyConfirmation(token, payload.operationId)).toBeNull()
    const [body, signature] = token.split('.')
    const altered = Buffer.from(JSON.stringify({ ...payload, balance: 2000 })).toString('base64url')
    expect(verifyConfirmation(altered + '.' + signature, payload.userId)).toBeNull()
    expect(verifyConfirmation(body + '.invalid', payload.userId)).toBeNull()
  })
  it('fails closed when no signing secret is configured', () => {
    vi.stubEnv('ROULETTE_CONFIRMATION_SECRET', '')
    expect(() => signConfirmation(payload)).toThrow('not configured')
  })
})
