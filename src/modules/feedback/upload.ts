import { createSupabaseBrowserClient } from '@/config/supabase.client'

const BUCKET = 'feedback-images'

export async function uploadFeedbackImages(files: File[]): Promise<string[]> {
  const supabase = createSupabaseBrowserClient()
  const urls: string[] = []

  for (const file of files) {
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })

    if (error) throw new Error(`Ошибка загрузки файла ${file.name}: ${error.message}`)

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    urls.push(data.publicUrl)
  }

  return urls
}
