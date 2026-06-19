import { createSupabaseAdminClient } from '@/config/supabase'
import type { DayOffRequest, DayOffRequestAdmin } from './types'

const SAFE_COLUMNS = 'id, ws_user_id, user_name, requested_date, note, screenshot_url, status, rejection_reason, reviewed_at, resolved_at, created_at' as const
const ADMIN_COLUMNS = `${SAFE_COLUMNS}, approved_by_name, rejected_by_name` as const

export async function getUserDayOffRequests(wsUserId: string): Promise<DayOffRequest[]> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('day_off_requests')
    .select(SAFE_COLUMNS)
    .eq('ws_user_id', wsUserId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('getUserDayOffRequests:', error.message)
    return []
  }
  return (data ?? []) as DayOffRequest[]
}

export async function getActiveDayOffRequest(wsUserId: string): Promise<DayOffRequest | null> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('day_off_requests')
    .select(SAFE_COLUMNS)
    .eq('ws_user_id', wsUserId)
    .in('status', ['pending'])
    .maybeSingle()

  if (error) {
    console.error('getActiveDayOffRequest:', error.message)
    return null
  }
  return data as DayOffRequest | null
}

export async function getAllDayOffRequestsAdmin(): Promise<DayOffRequestAdmin[]> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('day_off_requests')
    .select(ADMIN_COLUMNS)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('getAllDayOffRequestsAdmin:', error.message)
    return []
  }
  return (data ?? []) as DayOffRequestAdmin[]
}

export async function getUserAbsenceDates(
  wsUserId: string
): Promise<{ absence_date: string; absence_type: string }[]> {
  const supabase = createSupabaseAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('ws_user_absences')
    .select('absence_date, absence_type')
    .eq('user_id', wsUserId)
    .neq('absence_type', 'day_off')
    .gte('absence_date', today)

  if (error) {
    console.error('getUserAbsenceDates:', error.message)
    return []
  }
  return (data ?? []) as { absence_date: string; absence_type: string }[]
}

export async function getUserDayOffResolvedTimestamps(wsUserId: string): Promise<string[]> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('day_off_requests')
    .select('resolved_at')
    .eq('ws_user_id', wsUserId)
    .not('resolved_at', 'is', null)

  if (error) {
    console.error('getUserDayOffResolvedTimestamps:', error.message)
    return []
  }
  return (data ?? []).map((r) => r.resolved_at as string)
}

export async function getScreenshotSignedUrl(path: string): Promise<string | null> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .storage
    .from('day-off-screenshots')
    .createSignedUrl(path, 60 * 60) // 1 час

  if (error) {
    console.error('getScreenshotSignedUrl:', error.message)
    return null
  }
  return data.signedUrl
}