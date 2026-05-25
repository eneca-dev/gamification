import { cache } from 'react'

import { createSupabaseAdminClient } from '@/config/supabase'

import type { FeedbackRecord } from './types'

export const getFeedbackList = cache(async function getFeedbackList(): Promise<
  FeedbackRecord[]
> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('feedback')
    .select('*')
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data as FeedbackRecord[]
})
