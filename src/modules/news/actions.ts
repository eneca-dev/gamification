'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseAdminClient } from '@/config/supabase'
import { checkIsAdmin } from '@/modules/admin/checkIsAdmin'
import { getNewsDepartments } from './queries'
import { newsSchema } from './types'

export async function saveNews(input: unknown): Promise<{ success: true } | { success: false; error: string }> {
  if (!await checkIsAdmin()) return { success: false, error: 'Доступ запрещён' }
  const parsed = newsSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Проверьте название, текст и срок показа новости' }
  const item = parsed.data
  if (item.department_code && !(await getNewsDepartments()).includes(item.department_code)) {
    return { success: false, error: 'Отдел не найден' }
  }
  const supabase = createSupabaseAdminClient()
  const publishedAt = new Date().toISOString()
  const expirationFor = (start: string) => new Date(new Date(start).getTime() + item.duration_days * 86_400_000).toISOString()
  const payload = {
    title: item.title, body: item.body, category: item.category, department_code: item.department_code,
    updated_at: new Date().toISOString(),
  }
  if (item.id) {
    const { data: existing, error: lookupError } = await supabase.from('company_news')
      .select('published_at').eq('id', item.id).single()
    if (lookupError) return { success: false, error: lookupError.message }
    const start = existing.published_at ?? publishedAt
    const { error } = await supabase.from('company_news').update({ ...payload,
      published_at: item.published ? start : null,
      expires_at: item.published ? expirationFor(start) : null,
    }).eq('id', item.id)
    if (error) return { success: false, error: error.message }
  } else {
    const { error } = await supabase.from('company_news').insert({ ...payload,
      published_at: item.published ? publishedAt : null,
      expires_at: item.published ? expirationFor(publishedAt) : null,
    })
    if (error) return { success: false, error: error.message }
  }
  revalidatePath('/')
  revalidatePath('/admin/news')
  return { success: true }
}
