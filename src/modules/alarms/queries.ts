import { createSupabaseServerClient } from '@/config/supabase'

import type { Alarm } from './types'

export async function getActiveAlarms(userId: string): Promise<Alarm[]> {
  const supabase = await createSupabaseServerClient()
  // Синк данных из WS происходит в 00:00 по Минску — alarm_date = вчера по Минску
  const now = new Date()
  const minskNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Minsk' }))
  minskNow.setDate(minskNow.getDate() - 1)
  const alarmDate = minskNow.toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('alarms')
    .select('*')
    .eq('user_id', userId)
    .eq('alarm_date', alarmDate)
    .order('is_resolved', { ascending: true }) // active first
    .order('severity', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []) as Alarm[]
}

export async function getAllAlarms(userId: string): Promise<Alarm[]> {
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from('alarms')
    .select('*')
    .eq('user_id', userId)
    .order('alarm_date', { ascending: false })
    .order('is_resolved', { ascending: true })
    .order('severity', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []) as Alarm[]
}
