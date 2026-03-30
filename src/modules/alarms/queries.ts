import { createSupabaseServerClient } from '@/config/supabase'

import type { Alarm } from './types'

export async function getActiveAlarms(userId: string): Promise<Alarm[]> {
  const supabase = await createSupabaseServerClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('alarms')
    .select('*')
    .eq('user_id', userId)
    .eq('alarm_date', today)
    .order('is_resolved', { ascending: true }) // active first
    .order('severity', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []) as Alarm[]
}
