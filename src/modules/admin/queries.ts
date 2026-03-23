import { createSupabaseServerClient } from '@/config/supabase'

import type { EventTypeRow } from './types'

export async function getEventTypes(): Promise<EventTypeRow[]> {
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from('gamification_event_types')
    .select('key, name, coins, description, is_active')
    .order('coins', { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}
