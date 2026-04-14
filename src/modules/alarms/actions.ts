'use server'

import { createSupabaseAdminClient } from '@/config/supabase'
import { getCurrentUser } from '@/modules/auth/queries'
import { revalidatePath } from 'next/cache'

export async function resolveAlarm(alarmId: number): Promise<{ success: true } | { success: false; error: string }> {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Не авторизован' }

  const wsUserId = user.wsUserId
  if (!wsUserId) return { success: false, error: 'Не привязан к WS' }

  const supabase = createSupabaseAdminClient()

  const { error } = await supabase
    .from('alarms')
    .update({ is_resolved: true, resolved_at: new Date().toISOString() })
    .eq('id', alarmId)
    .eq('user_id', wsUserId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/')
  return { success: true }
}

export async function unresolveAlarm(alarmId: number): Promise<{ success: true } | { success: false; error: string }> {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Не авторизован' }

  const wsUserId = user.wsUserId
  if (!wsUserId) return { success: false, error: 'Не привязан к WS' }

  const supabase = createSupabaseAdminClient()

  const { error } = await supabase
    .from('alarms')
    .update({ is_resolved: false, resolved_at: null })
    .eq('id', alarmId)
    .eq('user_id', wsUserId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/')
  return { success: true }
}
