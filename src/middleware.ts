import { NextRequest, NextResponse } from 'next/server'

import { createSupabaseMiddlewareClient } from '@/config/supabase'

// Публичные пути: не требуют Supabase-сессии
// /signin-worksection — callback от WS, сессия создаётся внутри него
const PUBLIC_PATHS = ['/login', '/api/auth', '/signin-worksection']

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  )
}

function isAdminPath(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/')
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const { supabase, response } = createSupabaseMiddlewareClient(request)

  // getUser() — единственный надёжный способ проверить сессию в middleware
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && !isPublicPath(pathname)) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Защита админки: is_admin добавляется в JWT через custom_access_token_hook
  if (user && isAdminPath(pathname)) {
    const isAdmin = user.app_metadata?.is_admin === true
    if (!isAdmin) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    // Все пути кроме статики Next.js и медиафайлов
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
