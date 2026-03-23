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

// --- Users ---

export interface AdminUserRow {
  id: string
  email: string
  first_name: string
  last_name: string
  department: string | null
  team: string | null
  is_admin: boolean
  is_active: boolean
  total_coins: number
}

export interface UserTransaction {
  event_date: string
  event_type: string
  source: string
  coins: number
  description: string | null
  created_at: string
}

export interface UserDetail {
  user: AdminUserRow
  transactions: UserTransaction[]
}
