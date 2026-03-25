import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/config/supabase'
import { checkIsAdmin } from '@/modules/admin/checkIsAdmin'

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'] as const
const MAX_IMAGE_SIZE = 2 * 1024 * 1024

export async function POST(request: NextRequest) {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) {
    return NextResponse.json({ success: false, error: 'Доступ запрещён' }, { status: 403 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ success: false, error: 'Файл не выбран' })
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type as typeof ALLOWED_IMAGE_TYPES[number])) {
    return NextResponse.json({ success: false, error: 'Формат: JPEG, PNG или WebP' })
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return NextResponse.json({ success: false, error: 'Максимум 2 МБ' })
  }

  const rawExt = (file.name.split('.').pop() ?? '').toLowerCase()
  const ext = ALLOWED_EXTENSIONS.includes(rawExt as typeof ALLOWED_EXTENSIONS[number]) ? rawExt : 'jpg'

  const supabase = createSupabaseAdminClient()
  const path = `products/${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${ext}`

  const { error } = await supabase.storage
    .from('product-images')
    .upload(path, file)

  if (error) {
    return NextResponse.json({ success: false, error: 'Ошибка загрузки изображения' })
  }

  const { data: { publicUrl } } = supabase.storage
    .from('product-images')
    .getPublicUrl(path)

  return NextResponse.json({ success: true, url: publicUrl })
}
