/** Снимает кадр ~на 1-й секунде загруженного видео и возвращает JPEG-blob (постер).
 *  При любой ошибке — resolve(null). Используется клиентским кодом формы. */
export async function captureVideoPoster(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    video.crossOrigin = 'anonymous'
    const objectUrl = URL.createObjectURL(file)
    video.src = objectUrl
    let finished = false
    const timeout = setTimeout(() => finish(null), 10_000)

    const cleanup = () => {
      clearTimeout(timeout)
      URL.revokeObjectURL(objectUrl)
      video.remove()
    }

    const finish = (blob: Blob | null) => {
      if (finished) return
      finished = true
      cleanup()
      resolve(blob)
    }

    video.onerror = () => finish(null)

    video.onloadeddata = () => {
      const target = Math.min(1, (video.duration || 2) / 4)
      video.currentTime = Number.isFinite(target) && target > 0 ? target : 0.1
    }

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth || 640
        canvas.height = video.videoHeight || 360
        const ctx = canvas.getContext('2d')
        if (!ctx) return finish(null)
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        canvas.toBlob(
          (blob) => finish(blob),
          'image/jpeg',
          0.8,
        )
      } catch {
        finish(null)
      }
    }
  })
}
