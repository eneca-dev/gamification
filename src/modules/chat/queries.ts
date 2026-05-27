import { createSupabaseServerClient } from '@/config/supabase'
import { getCurrentUser } from '@/modules/auth'

import type { ChatMessage } from './types'

export async function getChatMessages(): Promise<ChatMessage[]> {
  const user = await getCurrentUser()
  if (!user) return []

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, user_id, role, content, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(50)

  if (error) return []
  return (data ?? []) as ChatMessage[]
}
