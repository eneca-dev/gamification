import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

import { createSupabaseAdminClient, createSupabaseServerClient } from '@/config/supabase'
import { worksectionConfig } from '@/config/worksection'
import type { ProfileRow, WorksectionTokenRow } from '@/lib/types'
import { wsTokenResponseSchema, wsResourceResponseSchema } from '@/modules/auth'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  const cookieStore = await cookies()
  const stateCookie = cookieStore.get('ws_oauth_state')?.value

  if (!state || !stateCookie || state !== stateCookie) {
    // Протухший/невалидный OAuth-flow (истёк cookie, старая ссылка, другой браузер)
    // — перезапускаем авторизацию автоматически.
    // ws_oauth_retry защищает от зацикливания, если браузер полностью блокирует cookies.
    if (cookieStore.get('ws_oauth_retry')?.value) {
      const errorResponse = NextResponse.redirect(
        new URL('/login?error=cookies_blocked', request.url)
      )
      errorResponse.cookies.delete('ws_oauth_retry')
      return errorResponse
    }

    const retryResponse = NextResponse.redirect(
      new URL('/api/auth/worksection', request.url)
    )
    retryResponse.cookies.set('ws_oauth_retry', '1', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60,
      path: '/',
    })
    return retryResponse
  }

  if (!code) {
    return new NextResponse('Missing authorization code', { status: 400 })
  }

  cookieStore.delete('ws_oauth_state')
  cookieStore.delete('ws_oauth_retry')

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

  const tokenParsed = wsTokenResponseSchema.safeParse(await tokenRes.json())

  if (!tokenParsed.success) {
    return new NextResponse('Invalid token response from Worksection', { status: 502 })
  }

  const { access_token, refresh_token, account_url, expires_in } = tokenParsed.data

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

  const resourceParsed = wsResourceResponseSchema.safeParse(await resourceRes.json())

  if (!resourceParsed.success) {
    return new NextResponse('Invalid resource response from Worksection', { status: 502 })
  }

  const resourceData = resourceParsed.data

  const email = resourceData.email.toLowerCase()
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
    // Пользователь уже существует — ищем по email через RPC
    const { data: existingId, error: rpcError } = await admin.rpc(
      'get_user_id_by_email',
      { lookup_email: email }
    )

    if (rpcError || !existingId) {
      return new NextResponse('Failed to find or create user', { status: 500 })
    }

    userId = existingId as string
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

  // Получение department и team из WS API
  let department: string | null = null
  let team: string | null = null

  try {
    const usersRes = await fetch(
      `${account_url}/api/oauth2?action=get_users`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    )

    if (usersRes.ok) {
      const usersJson = await usersRes.json()
      const wsUser = (usersJson?.data as Array<{ email?: string; department?: string; group?: string }>)
        ?.find((u) => u.email?.toLowerCase() === email)

      if (wsUser) {
        department = wsUser.department ?? null
        team = wsUser.group ?? null
      }
    }
  } catch {
    // Не блокируем вход при ошибке получения доп. данных
  }

  // Upsert профиля
  const { error: profileError } = await admin
    .from('profiles')
    .upsert({
      user_id: userId,
      email,
      first_name: resourceData.first_name ?? '',
      last_name: resourceData.last_name ?? '',
      department: team,
      team: department,
      updated_at: new Date().toISOString(),
    } satisfies Omit<ProfileRow, 'created_at'>)

  if (profileError) {
    return new NextResponse('Failed to store profile', { status: 500 })
  }

  // Связь ws_users с auth-пользователем (при каждом входе)
  await admin
    .from('ws_users')
    .update({ user_id: userId })
    .eq('email', email)
    .is('user_id', null)

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
