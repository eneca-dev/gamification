import { createSupabaseAdminClient } from '@/config/supabase'
import type { GratitudeFeedItem } from './types'

// Благодарности, полученные конкретным пользователем
// Использует adminClient: view JOIN-ит ws_users (service_role) и gamification_event_logs (service_role)
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
