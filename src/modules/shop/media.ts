import type { ProductMediaItem } from './types'

const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/

export function parseYouTubeId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  if (YOUTUBE_ID_RE.test(trimmed)) return trimmed

  let url: URL
  try {
    url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
  } catch {
    return null
  }

  const host = url.hostname.replace(/^www\./, '')

  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0]
    return YOUTUBE_ID_RE.test(id) ? id : null
  }

  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    const v = url.searchParams.get('v')
    if (v && YOUTUBE_ID_RE.test(v)) return v
    const path = url.pathname.split('/').filter(Boolean)
    if (path[0] === 'embed' || path[0] === 'shorts' || path[0] === 'live') {
      return YOUTUBE_ID_RE.test(path[1] ?? '') ? path[1] : null
    }
  }

  return null
}

export function youTubePoster(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
}

export function youTubeEmbedSrc(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&autoplay=1`
}

/** URL превью-постера для элемента (картинка, YouTube-постер или постер видео). */
export function mediaPoster(item: ProductMediaItem): string | null {
  if (item.kind === 'image') return item.url
  if (item.kind === 'youtube') return youTubePoster(item.video_id)
  return item.poster_url
}

/** Обложка товара: первое изображение в массиве, иначе null. */
export function coverImageUrl(media: ProductMediaItem[]): string | null {
  const first = media.find((m) => m.kind === 'image')
  return first ? first.url : null
}

/** Есть ли среди медиа видео (YouTube или загруженное). */
export function hasVideo(media: ProductMediaItem[]): boolean {
  return media.some((m) => m.kind === 'youtube' || m.kind === 'video')
}
