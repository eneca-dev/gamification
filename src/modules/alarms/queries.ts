import { createSupabaseAdminClient } from '@/config/supabase'
import { cached, CACHE_5M } from '@/lib/server-cache'

import type { Alarm } from './types'

async function _getActiveAlarms(userId: string): Promise<Alarm[]> {
  const supabase = createSupabaseAdminClient()
  const now = new Date()
  const minskNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Minsk' }))
  minskNow.setDate(minskNow.getDate() - 1)
  const alarmDate = minskNow.toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('alarms')
    .select('*')
    .eq('user_id', userId)
    .eq('alarm_date', alarmDate)
    .order('is_resolved', { ascending: true })
    .order('severity', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as Alarm[]
}

export const getActiveAlarms = (userId: string) =>
  cached(_getActiveAlarms, ['alarms', userId], {
    tags: [`alarms:${userId}`], revalidate: CACHE_5M,
  })(userId)

export async function getAllAlarms(userId: string): Promise<Alarm[]> {
  const supabase = createSupabaseAdminClient()

  const { data, error } = await supabase
    .from('alarms')
    .select('*')
    .eq('user_id', userId)
    .order('alarm_date', { ascending: false })
    .order('is_resolved', { ascending: true })
    .order('severity', { ascending: true })
    .limit(100)

  if (error) throw new Error(error.message)

  return (data ?? []) as Alarm[]
}
