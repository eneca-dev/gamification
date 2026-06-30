import { z } from 'zod'

// Ответ Worksection OAuth token endpoint
export const wsTokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  account_url: z.string().url(),
  expires_in: z.number(),
})

// Ответ Worksection resource endpoint (данные пользователя)
export const wsResourceResponseSchema = z.object({
  email: z.string().email(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
})

export interface AuthUser {
  id: string
  email: string
  fullName: string
  firstName: string
  lastName: string
  department: string | null
  team: string | null
  isAdmin: boolean
  wsUserId: string | null
  isImpersonating?: boolean
}
