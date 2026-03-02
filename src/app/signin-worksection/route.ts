import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

import { createSupabaseAdminClient, createSupabaseServerClient } from '@/config/supabase'
import { worksectionConfig } from '@/config/worksection'
import type { WorksectionTokenRow } from '@/lib/types'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  const cookieStore = await cookies()
  const stateCookie = cookieStore.get('ws_oauth_state')?.value

  if (!state || !stateCookie || state !== stateCookie) {
    return new NextResponse('Invalid state parameter', { status: 400 })
  }

  if (!code) {
    return new NextResponse('Missing authorization code', { status: 400 })
  }

  cookieStore.delete('ws_oauth_state')

  // Обмен кода на токены
  const tokenRes = await fetch(worksectionConfig.urls.token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: worksectionConfig.clientId,
      client_secret: worksectionConfig.clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: worksectionConfig.redirectUri,
    }),
  })

  if (!tokenRes.ok) {
    return new NextResponse('Token exchange failed', { status: 502 })
  }

  const { access_token, refresh_token, account_url, expires_in } =
    await tokenRes.json()

  // Данные пользователя из Worksection
  const resourceRes = await fetch(worksectionConfig.urls.resource, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: worksectionConfig.clientId,
      client_secret: worksectionConfig.clientSecret,
      access_token,
    }),
  })

  if (!resourceRes.ok) {
    return new NextResponse('User info fetch failed', { status: 502 })
  }

  const resourceData = await resourceRes.json()

  const email = (resourceData.email as string).toLowerCase()
  const name = `${resourceData.first_name ?? ''} ${resourceData.last_name ?? ''}`.trim()

  const admin = createSupabaseAdminClient()

  // Пробуем создать пользователя; если уже существует — находим по email
  let userId: string

  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email,
      user_metadata: { full_name: name },
      email_confirm: true,
    })

  if (created?.user) {
    userId = created.user.id
  } else if (createError) {
    // Пользователь уже существует — ищем через listUsers
    const { data: usersData, error: listError } =
      await admin.auth.admin.listUsers({ perPage: 1000 })

    if (listError) {
      return new NextResponse('Failed to list users', { status: 500 })
    }

    const existing = usersData?.users.find((u) => u.email === email)

    if (!existing) {
      return new NextResponse('Failed to find or create user', { status: 500 })
    }

    userId = existing.id
  } else {
    return new NextResponse('Failed to create user', { status: 500 })
  }

  // Сохранение WS-токенов (admin обходит RLS)
  const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString()

  const { error: upsertError } = await admin
    .from('worksection_tokens')
    .upsert({
      user_id: userId,
      access_token,
      refresh_token,
      account_url,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    } satisfies WorksectionTokenRow)

  if (upsertError) {
    return new NextResponse('Failed to store tokens', { status: 500 })
  }

  // Создание Supabase-сессии через magic link
  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({ type: 'magiclink', email })

  if (linkError || !linkData?.properties?.action_link) {
    return new NextResponse('Failed to generate session link', { status: 500 })
  }

  const tokenHash = linkData.properties.hashed_token

  if (!tokenHash) {
    return new NextResponse('Invalid session token', { status: 500 })
  }

  const supabase = await createSupabaseServerClient()
  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'magiclink',
  })

  if (verifyError) {
    return new NextResponse('Failed to establish session', { status: 500 })
  }

  return NextResponse.redirect(new URL('/', request.url))
}
