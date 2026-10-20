import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/config/supabase'
import { checkIsAdmin } from '@/modules/admin/checkIsAdmin'
import { assertCanUpload } from '@/lib/storage-quota'

const ALLOWED_EXTENSIONS = ['mp4', 'webm'] as const
const MAX_VIDEO_BYTES = 20 * 1024 * 1024

export async function POST(request: NextRequest) {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) {
    return NextResponse.json({ success: false, error: 'Доступ запрещён' }, { status: 403 })
  }

  let body: { ext?: string; size?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Невалидный запрос' }, { status: 400 })
  }

  const rawExt = (body.ext ?? '').toLowerCase()
  if (!ALLOWED_EXTENSIONS.includes(rawExt as typeof ALLOWED_EXTENSIONS[number])) {
    return NextResponse.json({ success: false, error: 'Формат: MP4 или WebM' }, { status: 400 })
  }

  const size = Number(body.size)
  if (!Number.isFinite(size) || size <= 0 || size > MAX_VIDEO_BYTES) {
    return NextResponse.json({ success: false, error: 'Максимум 20 МБ' }, { status: 400 })
  }

  try {
    await assertCanUpload(size)
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : 'Хранилище переполнено' }, { status: 507 })
  }

  const supabase = createSupabaseAdminClient()
  const path = `videos/${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${rawExt}`

  const { data, error } = await supabase.storage
    .from('product-videos')
    .createSignedUploadUrl(path)

  if (error || !data) {
    return NextResponse.json({ success: false, error: 'Не удалось создать ссылку загрузки' }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage
    .from('product-videos')
    .getPublicUrl(path)

  return NextResponse.json({
    success: true,
    signedUrl: data.signedUrl,
    token: data.token,
    path,
    publicUrl,
  })
}
