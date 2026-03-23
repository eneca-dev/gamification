import { z } from 'zod'

// --- Event Types ---

export interface EventTypeRow {
  key: string
  name: string
  coins: number
  description: string | null
  is_active: boolean
}

export const updateEventTypeSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1).optional(),
  coins: z.number().int().optional(),
  description: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
})

export type UpdateEventTypeInput = z.infer<typeof updateEventTypeSchema>
