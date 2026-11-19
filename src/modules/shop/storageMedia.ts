import { createSupabaseAdminClient } from '@/config/supabase'
import type { ProductMediaItem } from './types'

const STORAGE_PATHS = [
  { bucket: 'product-images', folder: /^(products|posters)\/[A-Za-z0-9_.-]+$/ },
  { bucket: 'product-videos', folder: /^videos\/[A-Za-z0-9_.-]+$/ },
] as const

/** Удаляет только файлы проекта, на которые больше не ссылаются товары. */
export async function removeUnreferencedProductMedia(urls: string[]): Promise<string | null> {
  if (urls.length === 0) return null
  try {
    const supabase = createSupabaseAdminClient()
    const candidates = new Map<string, { bucket: 'product-images' | 'product-videos'; path: string }>()

    for (const url of urls) {
      for (const { bucket, folder } of STORAGE_PATHS) {
        const marker = `/storage/v1/object/public/${bucket}/`
        let path: string
        try {
          const parsed = new URL(url)
          if (!parsed.pathname.includes(marker) || parsed.search || parsed.hash) continue
          path = parsed.pathname.split(marker)[1]
        } catch {
          continue
        }
        if (!folder.test(path)) continue
        const expected = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
        if (expected === url) candidates.set(url, { bucket, path })
      }
    }

    if (candidates.size === 0) return null

    let offset = 0
    while (true) {
      const { data, error } = await supabase.from('shop_products').select('id, media, image_url').order('id').range(offset, offset + 999)
      if (error) return 'Не удалось проверить ссылки на медиа перед очисткой'
      for (const row of data ?? []) {
        if (row.image_url) candidates.delete(row.image_url)
        const media = Array.isArray(row.media) ? row.media as ProductMediaItem[] : []
        for (const item of media) {
          if (item.kind === 'image' || item.kind === 'video') candidates.delete(item.url)
          if (item.kind === 'video' && item.poster_url) candidates.delete(item.poster_url)
        }
      }
      if (!data || data.length < 1000) break
      offset += 1000
    }

    // Лотереи могут использовать тот же bucket изображений.
    if ([...candidates.values()].some((item) => item.bucket === 'product-images')) {
      let lotteryOffset = 0
      while (true) {
        const { data, error } = await supabase.from('lottery_draws').select('id, image_url').order('id').range(lotteryOffset, lotteryOffset + 999)
        if (error) return 'Не удалось проверить изображения лотерей перед очисткой'
        for (const row of data ?? []) {
          if (row.image_url) candidates.delete(row.image_url)
        }
        if (!data || data.length < 1000) break
        lotteryOffset += 1000
      }
    }

    for (const bucket of ['product-images', 'product-videos'] as const) {
      const paths = [...candidates.values()].filter((item) => item.bucket === bucket).map((item) => item.path)
      if (paths.length === 0) continue
      const { error } = await supabase.storage.from(bucket).remove(paths)
      if (error) return `Не удалось удалить неиспользуемые файлы из ${bucket}`
    }
    return null
  } catch {
    return 'Не удалось очистить неиспользуемые медиафайлы'
  }
}
