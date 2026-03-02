'use server'

import { redirect } from 'next/navigation'

import { createSupabaseAdminClient, createSupabaseServerClient } from '@/config/supabase'
import { worksectionConfig } from '@/config/worksection'
import type { WorksectionTokenRow } from '@/lib/types'

import { getWorksectionTokens } from './queries'

export async function signOut() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect('/login')
}

// Вызывается программно (не из форм), при ошибке бросает исключение
export async function refreshWorksectionToken(userId: string): Promise<string> {
  const tokens = await getWorksectionTokens(userId)
  if (!tokens) throw new Error('No Worksection tokens found for user')

  const res = await fetch(worksectionConfig.urls.refresh, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: worksectionConfig.clientId,
      client_secret: worksectionConfig.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: tokens.refresh_token,
    }),
  })

  if (!res.ok) throw new Error('Failed to refresh Worksection token')

  const { access_token, refresh_token, expires_in } = await res.json()

  const admin = createSupabaseAdminClient()
  const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString()

  const { error } = await admin.from('worksection_tokens').upsert({
    user_id: userId,
    access_token,
    refresh_token,
    account_url: tokens.account_url,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  } satisfies WorksectionTokenRow)

  if (error) throw new Error('Failed to persist refreshed tokens')

  return access_token
}
