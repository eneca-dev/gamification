import { cookies } from 'next/headers'

import { createSupabaseServerClient } from '@/config/supabase'
import { getDevUserByEmail } from '@/modules/dev-tools/queries'
import type { WorksectionTokenRow } from '@/lib/types'

import type { AuthUser } from './types'

const IS_DEV = process.env.NODE_ENV === 'development'
const IMPERSONATE_COOKIE = 'dev_impersonate'

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

  // Dev-режим: подмена пользователя через cookie
  if (IS_DEV) {
    const cookieStore = await cookies()
    const impersonateEmail = cookieStore.get(IMPERSONATE_COOKIE)?.value
    if (impersonateEmail) {
      const devUser = await getDevUserByEmail(impersonateEmail)
      if (devUser) {
        return {
          id: `dev_${impersonateEmail}`,
          email: devUser.email,
          fullName: devUser.fullName,
          firstName: devUser.firstName,
          lastName: devUser.lastName,
          department: devUser.department,
          team: devUser.team,
          isImpersonating: true,
        }
      }
    }
  }

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
