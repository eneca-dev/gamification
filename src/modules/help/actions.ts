'use server'

import { revalidatePath } from 'next/cache'

import { createSupabaseAdminClient } from '@/config/supabase'
import { checkIsAdmin } from '@/modules/admin/checkIsAdmin'

const RESERVED_SLUGS = ['new']

interface UpdateArticleInput {
  slug: string
  title: string
  content: string
  folder_id: string
  is_published: boolean
  show_in_help: boolean
}

export async function updateHelpArticle(input: UpdateArticleInput) {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) return { success: false as const, error: 'Нет доступа' }

  const supabase = createSupabaseAdminClient()

  const { error, data } = await supabase
    .from('help_articles')
    .update({
      title: input.title,
      content: input.content,
      folder_id: input.folder_id,
      is_published: input.is_published,
      show_in_help: input.show_in_help,
    })
    .eq('slug', input.slug)
    .select()

  if (error) {
    return { success: false as const, error: error.message }
  }

  if (!data || data.length === 0) {
    return { success: false as const, error: 'Статья не найдена' }
  }

  revalidatePath('/help')
  revalidatePath('/admin/help')
  return { success: true as const }
}

interface CreateArticleInput {
  slug: string
  title: string
  content: string
  folder_id: string
  is_published?: boolean
  show_in_help?: boolean
}

export async function createHelpArticle(input: CreateArticleInput) {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) return { success: false as const, error: 'Нет доступа' }

  if (RESERVED_SLUGS.includes(input.slug)) {
    return { success: false as const, error: 'Slug "new" зарезервирован' }
  }

  const supabase = createSupabaseAdminClient()

  const { data: maxRow } = await supabase
    .from('help_articles')
    .select('sort_order')
    .eq('folder_id', input.folder_id)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single()

  const sortOrder = (maxRow?.sort_order ?? 0) + 1

  const { error } = await supabase
    .from('help_articles')
    .insert({
      slug: input.slug,
      title: input.title,
      content: input.content,
      folder_id: input.folder_id,
      sort_order: sortOrder,
      is_published: input.is_published ?? false,
      show_in_help: input.show_in_help ?? true,
    })

  if (error) {
    return { success: false as const, error: error.message }
  }

  revalidatePath('/help')
  revalidatePath('/admin/help')
  return { success: true as const }
}

export async function deleteHelpArticle(slug: string) {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) return { success: false as const, error: 'Нет доступа' }

  const supabase = createSupabaseAdminClient()

  const { error, data } = await supabase
    .from('help_articles')
    .delete()
    .eq('slug', slug)
    .select()

  if (error) {
    return { success: false as const, error: error.message }
  }

  if (!data || data.length === 0) {
    return { success: false as const, error: 'Статья не найдена' }
  }

  revalidatePath('/help')
  revalidatePath('/admin/help')
  return { success: true as const }
}

export async function getReembedStatus(): Promise<{
  status: 'running' | 'done' | 'error' | null
  error: string | null
}> {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) return { status: null, error: 'Нет доступа' }

  const supabase = createSupabaseAdminClient()
  const { data } = await supabase
    .from('chatbot_reembed_log')
    .select('status, error')
    .order('started_at', { ascending: false })
    .limit(1)
    .single()

  if (!data) return { status: null, error: null }
  return { status: data.status, error: data.error }
}

export async function triggerReembed() {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) return { success: false as const, error: 'Нет доступа' }

  const agentUrl = process.env.CHAT_AGENT_URL
  const secret = process.env.CHAT_AGENT_SECRET

  if (!agentUrl || !secret) {
    return { success: false as const, error: 'CHAT_AGENT_URL или CHAT_AGENT_SECRET не настроены' }
  }

  const res = await fetch(`${agentUrl}/reembed`, {
    method: 'POST',
    headers: { 'x-secret-key': secret },
  })

  if (!res.ok && res.status !== 202) {
    return { success: false as const, error: `Агент вернул ${res.status}` }
  }

  return { success: true as const }
}
