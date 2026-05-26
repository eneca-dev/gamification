import { z } from 'zod'

export type FeedbackType = 'bug' | 'suggestion'

export const FeedbackSchema = z.object({
  type: z.enum(['bug', 'suggestion']),
  header: z.string().min(1, 'Заголовок обязателен').max(200),
  description: z.string().optional(),
  expected_behavior: z.string().optional(),
  image_urls: z.array(z.string().url()).default([]),
})

export type FeedbackInput = z.infer<typeof FeedbackSchema>

export interface FeedbackRecord {
  id: string
  created_at: string
  type: FeedbackType
  header: string
  description: string | null
  expected_behavior: string | null
  image_urls: string[]
  airtable_id: string | null
  user_id: string | null
  user_name: string | null
  user_email: string | null
  user_department: string | null
  user_team: string | null
}
