'use server'

import { createSupabaseAdminClient, createSupabaseServerClient } from '@/config/supabase'
import { getCurrentUser } from '@/modules/auth'

/**
 * Возвращает список slug-ов туров, которые пользователь уже видел.
 * Вызывается один раз при монтировании OnboardingProvider (холодный старт).
 */
export async function getOnboardingSeenSlugs(userId: string): Promise<string[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('onboarding_seen')
    .eq('user_id', userId)
    .single()

  if (error || !data) return []
  return data.onboarding_seen ?? []
}

/**
 * Добавляет slug тура в onboarding_seen текущему пользователю.
 * Вызывается параллельно с записью в localStorage — не блокирует UI.
 * Использует admin client, т.к. RLS на profiles не разрешает UPDATE обычному
 * пользователю; поэтому пользователь берётся из серверной сессии, а не из
 * аргумента — иначе можно было бы отметить тур за кого-то другого.
 */
export async function markTourSeenInDb(pageSlug: string): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return
  const userId = user.id
  const supabase = createSupabaseAdminClient()

  // Читаем текущий массив, добавляем slug если его ещё нет
  const { data } = await supabase
    .from('profiles')
    .select('onboarding_seen')
    .eq('user_id', userId)
    .single()

  const current: string[] = data?.onboarding_seen ?? []
  if (current.includes(pageSlug)) return

  await supabase
    .from('profiles')
    .update({ onboarding_seen: [...current, pageSlug] })
    .eq('user_id', userId)
}
