import { createSupabaseServerClient } from '@/config/supabase'
import type { WorksectionTokenRow } from '@/lib/types'

import type { AuthUser } from './types'

export async function getWorksectionTokens(
  userId: string
): Promise<WorksectionTokenRow | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('worksection_tokens')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error || !data) return null
  return data as WorksectionTokenRow
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name, department, team')
    .eq('user_id', user.id)
    .single()

  // is_admin и ws_user_id добавляются в JWT через custom_access_token_hook
  const claims = user.app_metadata ?? {}

  return {
    id: user.id,
    email: user.email ?? '',
    fullName: user.user_metadata?.full_name ?? '',
    firstName: profile?.first_name ?? '',
    lastName: profile?.last_name ?? '',
    department: profile?.department ?? null,
    team: profile?.team ?? null,
    isAdmin: claims.is_admin === true,
    wsUserId: typeof claims.ws_user_id === 'string' ? claims.ws_user_id : null,
  }
}
