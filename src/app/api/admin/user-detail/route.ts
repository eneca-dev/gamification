import { NextRequest, NextResponse } from 'next/server'

import { checkIsAdmin } from '@/modules/admin/checkIsAdmin'
import { getUserDetail } from '@/modules/admin/queries'

export async function GET(request: NextRequest) {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const userId = request.nextUrl.searchParams.get('id')
  if (!userId) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  const detail = await getUserDetail(userId)
  if (!detail) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(detail)
}
