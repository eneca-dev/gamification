import { createSupabaseServerClient } from '@/config/supabase'

import type { HelpArticle, HelpFolder } from './types'

// --- Шаблонные переменные {{key}} → значения из БД ---

async function buildVariablesMap(): Promise<Record<string, string>> {
  const supabase = await createSupabaseServerClient()

  const [eventTypes, gratitudeSettings, shieldProducts] = await Promise.all([
    supabase.from('gamification_event_types').select('key, coins'),
    supabase.from('ach_gratitude_settings').select('category, threshold, bonus_coins'),
    supabase.from('shop_products').select('effect, price').like('effect', 'streak_shield_%'),
  ])

  const vars: Record<string, string> = {}

  // gamification_event_types: {{green_day}} → "3"
  for (const row of eventTypes.data ?? []) {
    vars[row.key] = String(Math.abs(row.coins))
  }

  // ach_gratitude_settings: {{gratitude_threshold}} → "4", {{gratitude_bonus}} → "200"
  const gratRows = gratitudeSettings.data ?? []
  if (gratRows.length > 0) {
    vars['gratitude_threshold'] = String(gratRows[0].threshold)
    vars['gratitude_bonus'] = String(gratRows[0].bonus_coins)
  }

  // shop_products (щиты): {{shield_price_ws}} → "500"
  for (const row of shieldProducts.data ?? []) {
    if (row.effect === 'streak_shield_ws') vars['shield_price_ws'] = String(row.price)
    if (row.effect === 'streak_shield_revit') vars['shield_price_revit'] = String(row.price)
  }

  return vars
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function replaceVariables(content: string, vars: Record<string, string>): string {
  return content.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = vars[key]
    return value !== undefined ? escapeHtml(value) : match
  })
}

function applyVariables(articles: HelpArticle[], vars: Record<string, string>): HelpArticle[] {
  return articles.map((a) => ({ ...a, content: replaceVariables(a.content, vars) }))
}

// --- Запросы ---

export async function getHelpArticles(): Promise<HelpArticle[]> {
  const supabase = await createSupabaseServerClient()
  const [articlesResult, vars] = await Promise.all([
    supabase.from('help_articles').select('*').eq('is_published', true).order('sort_order'),
    buildVariablesMap(),
  ])

  if (articlesResult.error) throw articlesResult.error
  return applyVariables(articlesResult.data ?? [], vars)
}

export async function getHelpArticle(slug: string): Promise<HelpArticle | null> {
  const supabase = await createSupabaseServerClient()
  const [articleResult, vars] = await Promise.all([
    supabase.from('help_articles').select('*').eq('slug', slug).eq('is_published', true).single(),
    buildVariablesMap(),
  ])

  if (articleResult.error) {
    if (articleResult.error.code === 'PGRST116') return null
    throw articleResult.error
  }

  const article = articleResult.data
  return { ...article, content: replaceVariables(article.content, vars) }
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

/** Все статьи для админки (включая неопубликованные) — без подстановки переменных */
export async function getAllHelpArticles(): Promise<HelpArticle[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('help_articles')
    .select('*')
    .order('sort_order')

  if (error) throw error
  return data ?? []
}
