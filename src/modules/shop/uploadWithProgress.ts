/** PUT загрузка через XHR с progress-событиями и возможностью отмены.
 *  signedUrl — URL из Supabase createSignedUploadUrl. onProgress получает 0..100. */
export function uploadWithProgress(options: {
  url: string
  file: Blob | File
  contentType: string
  onProgress?: (percent: number) => void
  signal?: AbortSignal
}): Promise<void> {
  const { url, file, contentType, onProgress, signal } = options

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url, true)
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.setRequestHeader('x-upsert', 'false')

    xhr.upload.onprogress = (e) => {
      if (!onProgress || !e.lengthComputable) return
      onProgress(Math.min(100, Math.round((e.loaded / e.total) * 100)))
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`Загрузка не удалась (${xhr.status})`))
    }
    xhr.onerror = () => reject(new Error('Сетевая ошибка загрузки'))
    xhr.onabort = () => reject(new DOMException('Aborted', 'AbortError'))

    if (signal) {
      if (signal.aborted) {
        reject(new DOMException('Aborted', 'AbortError'))
        return
      }
      signal.addEventListener('abort', () => xhr.abort(), { once: true })
    }

    xhr.send(file)
  })
}
