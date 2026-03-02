import { NextResponse } from 'next/server'

import { worksectionConfig } from '@/config/worksection'

export async function GET() {
  const state = crypto.randomUUID()

  const params = new URLSearchParams({
    client_id: worksectionConfig.clientId,
    response_type: 'code',
    redirect_uri: worksectionConfig.redirectUri,
    state,
    scope: worksectionConfig.scope,
  })

  const response = NextResponse.redirect(
    `${worksectionConfig.urls.authorize}?${params}`
  )

  // Cookie ставим напрямую на response — иначе не прикрепится к redirect
  response.cookies.set('ws_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 5,
    path: '/',
  })

  return response
}
