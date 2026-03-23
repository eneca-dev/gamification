'use server'

import { revalidatePath } from 'next/cache'

import { createSupabaseAdminClient } from '@/config/supabase'

import { checkIsAdmin } from './checkIsAdmin'
import { updateEventTypeSchema } from './types'

export async function updateEventType(
  input: { key: string; name?: string; coins?: number; description?: string | null; is_active?: boolean }
): Promise<{ success: true } | { success: false; error: string }> {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) return { success: false, error: 'Доступ запрещён' }

  const parsed = updateEventTypeSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Невалидные данные' }

  const { key, ...fields } = parsed.data

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (fields.name !== undefined) updateData.name = fields.name
  if (fields.coins !== undefined) updateData.coins = fields.coins
  if (fields.description !== undefined) updateData.description = fields.description
  if (fields.is_active !== undefined) updateData.is_active = fields.is_active

  const supabase = createSupabaseAdminClient()

  const { data, error } = await supabase
    .from('gamification_event_types')
    .update(updateData)
    .eq('key', key)
    .select('key')

  if (error) return { success: false, error: error.message }

  // RLS может молча заблокировать UPDATE — проверяем что строка обновилась
  if (!data || data.length === 0) {
    return { success: false, error: 'Не удалось обновить: проверьте права доступа' }
  }

  revalidatePath('/admin/events')
  return { success: true }
}
