import { createSupabaseAdminClient } from '@/config/supabase'

import type { GratitudeFeedItem, GratitudeNew, SenderQuota, GratitudeRecipient } from './types'

// Благодарности из старой таблицы at_gratitudes (для совместимости)
export async function getUserGratitudes(
  recipientEmail: string,
  limit = 20
): Promise<GratitudeFeedItem[]> {
  const supabase = createSupabaseAdminClient()

  const { data, error } = await supabase
    .from('v_gratitudes_feed')
    .select('*')
    .eq('recipient_email', recipientEmail)
    .order('airtable_created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`getUserGratitudes: ${error.message}`)

  return data as GratitudeFeedItem[]
}

// Благодарности из новой таблицы gratitudes
export async function getGratitudesFeedNew(limit = 30): Promise<GratitudeNew[]> {
  const supabase = createSupabaseAdminClient()

  const { data, error } = await supabase
    .from('v_gratitudes_feed_new')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('getGratitudesFeedNew:', error.message)
    return []
  }

  return data as GratitudeNew[]
}

// Благодарности компании за период
export async function getCompanyGratitudes(
  since: string,
  limit = 100
): Promise<GratitudeNew[]> {
  const supabase = createSupabaseAdminClient()

  const { data, error } = await supabase
    .from('v_gratitudes_feed_new')
    .select('*')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('getCompanyGratitudes:', error.message)
    return []
  }

  return data as GratitudeNew[]
}

// Благодарности пользователя (отправленные + полученные)
export async function getMyGratitudesNew(userEmail: string, limit = 20): Promise<GratitudeNew[]> {
  const supabase = createSupabaseAdminClient()

  const [sentRes, receivedRes] = await Promise.all([
    supabase
      .from('v_gratitudes_feed_new')
      .select('*')
      .eq('sender_email', userEmail)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('v_gratitudes_feed_new')
      .select('*')
      .eq('recipient_email', userEmail)
      .order('created_at', { ascending: false })
      .limit(limit),
  ])

  if (sentRes.error || receivedRes.error) {
    console.error('getMyGratitudesNew:', sentRes.error?.message ?? receivedRes.error?.message)
    return []
  }

  const merged = [...(sentRes.data ?? []), ...(receivedRes.data ?? [])]
  const unique = Array.from(new Map(merged.map((g) => [g.id, g])).values())
  return unique
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit) as GratitudeNew[]
}

// Квота отправителя (2-недельный период)
export async function getSenderQuota(senderId: string): Promise<SenderQuota> {
  const supabase = createSupabaseAdminClient()

  const { data, error } = await supabase.rpc('get_sender_quota', {
    p_sender_id: senderId,
  })

  if (error) {
    console.error('getSenderQuota:', error.message)
    return { used: true, coins_per_gratitude: 0, period_start: '', period_end: '', next_quota_date: null }
  }

  return data as SenderQuota
}

// Список получателей для выбора (исключаем текущего пользователя)
export async function getGratitudeRecipients(
  excludeUserId: string
): Promise<GratitudeRecipient[]> {
  const supabase = createSupabaseAdminClient()

  const { data, error } = await supabase
    .from('ws_users')
    .select('id, first_name, last_name, department_code')
    .eq('is_active', true)
    .neq('id', excludeUserId)
    .not('team', 'eq', 'Декретный')
    .order('last_name')

  if (error) {
    console.error('getGratitudeRecipients:', error.message)
    return []
  }

  return (data ?? []).map((u) => ({
    id: u.id,
    name: `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim(),
    department: u.department_code,
  }))
}

// Баланс пользователя
export async function getUserBalance(userId: string): Promise<number> {
  const supabase = createSupabaseAdminClient()

  const { data, error } = await supabase
    .from('gamification_balances')
    .select('total_coins')
    .eq('user_id', userId)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('getUserBalance:', error.message)
  }

  return data?.total_coins ?? 0
}
