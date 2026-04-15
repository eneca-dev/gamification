import { createSupabaseServerClient } from '@/config/supabase'

import type { HelpArticle, HelpFolder } from './types'

export async function getHelpArticles(): Promise<HelpArticle[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('help_articles')
    .select('*')
    .eq('is_published', true)
    .order('sort_order')

  if (error) throw error
  return data ?? []
}

export async function getHelpArticle(slug: string): Promise<HelpArticle | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('help_articles')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data
}

export async function getHelpFolders(): Promise<HelpFolder[]> {
  const articles = await getHelpArticles()

  const map = new Map<string, HelpFolder>()
  for (const a of articles) {
    if (!map.has(a.folder)) {
      map.set(a.folder, { folder: a.folder, folder_label: a.folder_label, articles: [] })
    }
    map.get(a.folder)!.articles.push({ slug: a.slug, title: a.title, content: a.content })
  }

  return [...map.values()]
}

/** Все статьи для админки (включая неопубликованные) */
export async function getAllHelpArticles(): Promise<HelpArticle[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('help_articles')
    .select('*')
    .order('sort_order')

  if (error) throw error
  return data ?? []
}
