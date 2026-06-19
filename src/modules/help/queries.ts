import { createSupabaseAdminClient, createSupabaseServerClient } from '@/config/supabase'

import type { HelpArticle, HelpChunk, HelpFolder, HelpVariableMeta, ReembedLog } from './types'

// --- Шаблонные переменные {{key}} → значения из БД ---

export async function getHelpVariables(): Promise<Record<string, string>> {
  return buildVariablesMap()
}

export async function getHelpVariablesMeta(): Promise<HelpVariableMeta[]> {
  const supabase = await createSupabaseServerClient()

  const [eventTypes, gratitudeSettings, shieldProducts, crystalRate] = await Promise.all([
    supabase
      .from('gamification_event_types')
      .select('key, name, coins')
      .eq('is_active', true)
      .or('coins.neq.0,key.eq.red_day'),
    supabase.from('ach_gratitude_settings').select('category, threshold, bonus_coins'),
    supabase.from('shop_products').select('effect, cost_byn, coefficient, name').like('effect', 'streak_shield_%'),
    supabase.rpc('current_crystal_rate'),
  ])

  const result: HelpVariableMeta[] = []
  const rate = Number(crystalRate.data ?? 0)

  for (const row of eventTypes.data ?? []) {
    result.push({ key: row.key, name: row.name ?? row.key, value: String(Math.abs(row.coins)) })
  }

  const gratRows = gratitudeSettings.data ?? []
  if (gratRows.length > 0) {
    result.push({ key: 'gratitude_threshold', name: 'Порог достижений за благодарности', value: String(gratRows[0].threshold) })
    result.push({ key: 'gratitude_bonus', name: 'Бонус за достижения благодарности', value: String(gratRows[0].bonus_coins) })
  }

  for (const row of shieldProducts.data ?? []) {
    const price = String(Math.round(Number(row.cost_byn) * Number(row.coefficient) * rate))
    if (row.effect === 'streak_shield_ws') result.push({ key: 'shield_price_ws', name: row.name ?? 'Цена щита WS', value: price })
    if (row.effect === 'streak_shield_revit') result.push({ key: 'shield_price_revit', name: row.name ?? 'Цена щита Revit', value: price })
  }

  return result
}

async function buildVariablesMap(): Promise<Record<string, string>> {
  const supabase = await createSupabaseServerClient()

  const [eventTypes, gratitudeSettings, shieldProducts, crystalRate] = await Promise.all([
    supabase.from('gamification_event_types').select('key, coins'),
    supabase.from('ach_gratitude_settings').select('category, threshold, bonus_coins'),
    supabase.from('shop_products').select('effect, cost_byn, coefficient').like('effect', 'streak_shield_%'),
    supabase.rpc('current_crystal_rate'),
  ])

  const vars: Record<string, string> = {}
  const rate = Number(crystalRate.data ?? 0)

  for (const row of eventTypes.data ?? []) {
    vars[row.key] = String(Math.abs(row.coins))
  }

  const gratRows = gratitudeSettings.data ?? []
  if (gratRows.length > 0) {
    vars['gratitude_threshold'] = String(gratRows[0].threshold)
    vars['gratitude_bonus'] = String(gratRows[0].bonus_coins)
  }

  // shop_products (щиты): {{shield_price_ws}} → "500" (cost_byn × coefficient × курс кристалла)
  for (const row of shieldProducts.data ?? []) {
    const price = String(Math.round(Number(row.cost_byn) * Number(row.coefficient) * rate))
    if (row.effect === 'streak_shield_ws') vars['shield_price_ws'] = price
    if (row.effect === 'streak_shield_revit') vars['shield_price_revit'] = price
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

/** Статьи для пользовательской справки: опубликованные и show_in_help = true */
export async function getHelpArticles(): Promise<HelpArticle[]> {
  const supabase = await createSupabaseServerClient()
  const [articlesResult, vars] = await Promise.all([
    supabase
      .from('help_articles')
      .select('*')
      .eq('is_published', true)
      .eq('show_in_help', true)
      .order('sort_order'),
    buildVariablesMap(),
  ])

  if (articlesResult.error) throw articlesResult.error
  return applyVariables(articlesResult.data ?? [], vars)
}

export async function getHelpArticle(slug: string): Promise<HelpArticle | null> {
  const supabase = await createSupabaseServerClient()
  const [articleResult, vars] = await Promise.all([
    supabase
      .from('help_articles')
      .select('*')
      .eq('slug', slug)
      .eq('is_published', true)
      .single(),
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
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('help_articles')
    .select('*')
    .order('sort_order')

  if (error) throw error
  return data ?? []
}

/** Статьи чат-бота (show_in_help = false) с их чанками для страницы /admin/chatbot */
export async function getChatbotArticlesWithChunks(): Promise<
  Array<HelpArticle & { chunks: HelpChunk[] }>
> {
  const supabase = createSupabaseAdminClient()

  const { data: articles, error: articlesError } = await supabase
    .from('help_articles')
    .select('*')
    .eq('show_in_help', false)
    .order('sort_order')

  if (articlesError) throw articlesError

  if (!articles || articles.length === 0) return []

  const articleIds = articles.map((a) => a.id)

  const { data: chunks, error: chunksError } = await supabase
    .from('help_article_chunks')
    .select('id, article_id, slug, chunk_index, content, created_at')
    .in('article_id', articleIds)
    .order('chunk_index')

  if (chunksError) throw chunksError

  const chunksByArticle = new Map<string, HelpChunk[]>()
  for (const chunk of chunks ?? []) {
    if (!chunksByArticle.has(chunk.article_id)) chunksByArticle.set(chunk.article_id, [])
    chunksByArticle.get(chunk.article_id)!.push(chunk)
  }

  return articles.map((a) => ({ ...a, chunks: chunksByArticle.get(a.id) ?? [] }))
}

/** Последняя запись лога векторизации */
export async function getLastReembedLog(): Promise<ReembedLog | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('chatbot_reembed_log')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(1)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }

  return data
}
