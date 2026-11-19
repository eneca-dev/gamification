import { z } from 'zod'

export const SECTORS = ['x2', 'plus500', 'plus200', 'plus100', 'plus50', 'zero1', 'zero2'] as const
export const SECTOR_LABELS: Record<typeof SECTORS[number], string> = {
  x2: '×2', plus500: '+500', plus200: '+200', plus100: '+100', plus50: '+50', zero1: '0', zero2: '0',
}
export const periodSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)
const coins = z.number().int().min(0).max(2147483647)

export const spinResultSchema = z.object({
  operationId: z.string().uuid(),
  period: periodSchema,
  sector: z.enum(SECTORS),
  balanceBefore: coins.positive(),
  balanceAfter: coins,
  delta: z.number().int(),
  completedAt: z.string().datetime({ offset: true }),
}).superRefine((result, ctx) => {
  const after = result.sector === 'x2' ? result.balanceBefore * 2
    : result.sector.startsWith('zero') ? 0
    : result.balanceBefore + Number(result.sector.slice(4))
  if (after !== result.balanceAfter || result.delta !== result.balanceAfter - result.balanceBefore) {
    ctx.addIssue({ code: 'custom', message: 'Inconsistent roulette result' })
  }
})
export const spinResponseSchema = z.object({ result: spinResultSchema, replayed: z.boolean() })
export const rouletteStateSchema = z.object({
  enabled: z.boolean(), period: periodSchema, result: spinResultSchema.nullable(),
}).refine(state => !state.result || state.result.period === state.period, 'Result period differs from current period')
export const confirmationPayloadSchema = z.object({
  purpose: z.literal('roulette-confirmation-v1'),
  userId: z.string().uuid(), operationId: z.string().uuid(),
  period: periodSchema, balance: coins.positive(),
})
export const confirmationSchema = z.object({
  token: z.string().max(4096), operationId: z.string().uuid(),
  period: periodSchema, balance: coins.positive(),
})
export type SpinResult = z.infer<typeof spinResultSchema>
export type SpinResponse = z.infer<typeof spinResponseSchema>
export type RouletteState = z.infer<typeof rouletteStateSchema>
export type Confirmation = z.infer<typeof confirmationSchema>
export type ConfirmationPayload = z.infer<typeof confirmationPayloadSchema>
