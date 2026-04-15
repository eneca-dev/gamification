'use server'

import { revalidatePath } from 'next/cache'

import { createSupabaseServerClient } from '@/config/supabase'
import { checkIsAdmin } from '@/modules/admin/checkIsAdmin'

const RESERVED_SLUGS = ['new']

interface UpdateArticleInput {
  slug: string
  title: string
  content: string
  folder: string
  folder_label: string
  sort_order: number
  is_published: boolean
}

export async function updateHelpArticle(input: UpdateArticleInput) {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) return { success: false as const, error: 'Нет доступа' }

  const supabase = await createSupabaseServerClient()

  const { error, data } = await supabase
    .from('help_articles')
    .update({
      title: input.title,
      content: input.content,
      folder: input.folder,
      folder_label: input.folder_label,
      sort_order: input.sort_order,
      is_published: input.is_published,
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
  folder: string
  folder_label: string
  sort_order: number
  is_published?: boolean
}

export async function createHelpArticle(input: CreateArticleInput) {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) return { success: false as const, error: 'Нет доступа' }

  if (RESERVED_SLUGS.includes(input.slug)) {
    return { success: false as const, error: 'Slug "new" зарезервирован' }
  }

  const supabase = await createSupabaseServerClient()

  const { error } = await supabase
    .from('help_articles')
    .insert({
      slug: input.slug,
      title: input.title,
      content: input.content,
      folder: input.folder,
      folder_label: input.folder_label,
      sort_order: input.sort_order,
      is_published: input.is_published ?? false,
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

  const supabase = await createSupabaseServerClient()

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
