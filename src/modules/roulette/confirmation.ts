import { createHmac, timingSafeEqual } from 'node:crypto'
import { confirmationPayloadSchema, type ConfirmationPayload } from './types'

function signingKey(): string {
  const key = process.env.ROULETTE_CONFIRMATION_SECRET
  if (!key || Buffer.byteLength(key) < 32) throw new Error('Roulette confirmation key is not configured')
  return key
}

export function signConfirmation(payload: ConfirmationPayload): string {
  const body = Buffer.from(JSON.stringify(confirmationPayloadSchema.parse(payload))).toString('base64url')
  const signature = createHmac('sha256', signingKey()).update(body).digest('base64url')
  return body + '.' + signature
}

export function verifyConfirmation(token: string, userId: string): ConfirmationPayload | null {
  if (token.length > 4096) return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const expected = createHmac('sha256', signingKey()).update(parts[0]).digest()
  const received = Buffer.from(parts[1], 'base64url')
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null
  try {
    const parsed = confirmationPayloadSchema.safeParse(JSON.parse(Buffer.from(parts[0], 'base64url').toString()))
    return parsed.success && parsed.data.userId === userId ? parsed.data : null
  } catch { return null }
}
