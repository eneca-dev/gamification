import { createSupabaseAdminClient } from '@/config/supabase'
import type { NewsItem } from './types'

export async function getNewsForDashboard(departmentCode: string | null): Promise<NewsItem[]> {
  const supabase = createSupabaseAdminClient()
  const now = new Date().toISOString()
  const base = () => supabase.from('company_news').select('id,title,body,category,department_code,published_at,expires_at,created_at')
    .not('published_at', 'is', null).lte('published_at', now).gt('expires_at', now)
    .order('published_at', { ascending: false }).limit(30)
  const [global, department] = await Promise.all([
    base().is('department_code', null),
    departmentCode ? base().eq('department_code', departmentCode) : Promise.resolve({ data: [], error: null }),
  ])
  if (global.error || department.error) throw new Error(global.error?.message ?? department.error?.message)
  return [...(global.data ?? []), ...(department.data ?? [])]
    .sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? '')).slice(0, 30) as NewsItem[]
}

export async function getAllNews(): Promise<{ items: NewsItem[]; now: number }> {
  const now = Date.now()
  const supabase = createSupabaseAdminClient()
  const items: NewsItem[] = []
  const pageSize = 500
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.from('company_news')
      .select('id,title,body,category,department_code,published_at,expires_at,created_at')
      .order('created_at', { ascending: false }).order('id', { ascending: false })
      .range(offset, offset + pageSize - 1)
    if (error) throw new Error(error.message)
    items.push(...(data ?? []) as NewsItem[])
    if (!data || data.length < pageSize) break
  }
  return { items, now }
}

export async function getNewsDepartments(): Promise<string[]> {
  const { data, error } = await createSupabaseAdminClient().from('ws_users')
    .select('department_code').eq('is_active', true).not('department_code', 'is', null)
  if (error) throw new Error(error.message)
  return [...new Set((data ?? []).map(row => row.department_code as string))].sort()
}
