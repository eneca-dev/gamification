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

  return {
    id: user.id,
    email: user.email ?? '',
    fullName: user.user_metadata?.full_name ?? '',
  }
}
