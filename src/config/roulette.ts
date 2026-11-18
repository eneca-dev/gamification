import { z } from 'zod'

/** Fail closed until the pilot account is explicitly configured on the server. */
export function canUseRoulettePilot(user: { email: string; isImpersonating?: boolean } | null): boolean {
  if (!user || user.isImpersonating) return false
  const configured = z.string().trim().email().safeParse(process.env.ROULETTE_PILOT_EMAIL)
  return configured.success && user.email.trim().toLowerCase() === configured.data.toLowerCase()
}

