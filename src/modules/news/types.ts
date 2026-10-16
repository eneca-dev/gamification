import { z } from 'zod'

export const NEWS_CATEGORIES = {
  bug: 'Баг', app_changes: 'Изменения в работе приложения',
} as const

export const newsSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(5000),
  category: z.enum(['bug', 'app_changes']),
  department_code: z.string().trim().min(1).max(100).nullable(),
  duration_days: z.number().int().min(1).max(365),
  published: z.boolean(),
})

export type NewsInput = z.infer<typeof newsSchema>
export interface NewsItem extends Omit<NewsInput, 'published' | 'duration_days'> {
  id: string
  published_at: string | null
  expires_at: string | null
  created_at: string
}
