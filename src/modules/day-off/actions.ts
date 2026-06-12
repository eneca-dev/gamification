'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseAdminClient } from '@/config/supabase'
import { getCurrentUser } from '@/modules/auth/queries'
import { checkIsAdmin } from '@/modules/admin/checkIsAdmin'
import { submitDayOffSchema, rejectDayOffSchema, submitBatchDayOffSchema } from './types'
import type { SubmitDayOffInput, RejectDayOffInput, SubmitBatchDayOffInput } from './types'

export async function submitDayOffRequest(
  input: SubmitDayOffInput
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const user = await getCurrentUser()
  if (!user?.wsUserId) return { success: false, error: 'Необходима авторизация' }

  const parsed = submitDayOffSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message }

  const supabase = createSupabaseAdminClient()

  const { data: conflict } = await supabase
    .from('ws_user_absences')
    .select('absence_type')
    .eq('user_id', user.wsUserId)
    .eq('absence_date', parsed.data.requested_date)
    .neq('absence_type', 'day_off')
    .maybeSingle()

  if (conflict) return { success: false, error: 'На этот день уже есть отпуск или больничный' }

  // user_name и status проставляются триггером trg_day_off_requests_before_insert
  const { data, error } = await supabase
    .from('day_off_requests')
    .insert({
      ws_user_id:     user.wsUserId,
      requested_date: parsed.data.requested_date,
      note:           parsed.data.note ?? null,
      screenshot_url: parsed.data.screenshot_url,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: 'Не удалось создать заявку' }

  revalidatePath('/day-off')
  return { success: true, id: data.id }
}

export async function submitBatchDayOffRequests(
  input: SubmitBatchDayOffInput
): Promise<{ success: true; ids: string[] } | { success: false; error: string }> {
  const user = await getCurrentUser()
  if (!user?.wsUserId) return { success: false, error: 'Необходима авторизация' }

  const parsed = submitBatchDayOffSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message }

  const now = new Date()
  for (const date of parsed.data.requested_dates) {
    if (new Date(date) <= now) {
      return { success: false, error: `Дата ${date} должна быть в будущем` }
    }
  }

  const supabase = createSupabaseAdminClient()
  const wsUserId = user.wsUserId

  const { data: conflicts } = await supabase
    .from('ws_user_absences')
    .select('absence_date')
    .eq('user_id', wsUserId)
    .in('absence_date', parsed.data.requested_dates)
    .neq('absence_type', 'day_off')

  if (conflicts?.length) {
    return { success: false, error: `На ${conflicts[0].absence_date} уже есть отпуск или больничный` }
  }

  const rows = parsed.data.requested_dates.map(date => ({
    ws_user_id:     wsUserId,
    requested_date: date,
    note:           parsed.data.note ?? null,
    screenshot_url: parsed.data.screenshot_url,
  }))

  const { data, error } = await supabase
    .from('day_off_requests')
    .insert(rows)
    .select('id')

  if (error) return { success: false, error: 'Не удалось создать заявки' }

  revalidatePath('/day-off')
  return { success: true, ids: data.map(r => r.id) }
}

export async function uploadDayOffScreenshot(
  formData: FormData
): Promise<{ success: true; path: string } | { success: false; error: string }> {
  const user = await getCurrentUser()
  if (!user?.wsUserId) return { success: false, error: 'Необходима авторизация' }

  const file = formData.get('file') as File | null
  if (!file) return { success: false, error: 'Файл не выбран' }

  if (file.size > 5 * 1024 * 1024) return { success: false, error: 'Файл не должен превышать 5 МБ' }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${user.wsUserId}/${Date.now()}.${ext}`

  const supabase = createSupabaseAdminClient()
  const { error } = await supabase.storage
    .from('day-off-screenshots')
    .upload(path, file, { upsert: false })

  if (error) return { success: false, error: 'Не удалось загрузить файл' }

  return { success: true, path }
}

export async function approveDayOffRequest(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) return { success: false, error: 'Нет прав' }

  const [admin, supabase] = [await getCurrentUser(), createSupabaseAdminClient()]

  // Атомарный UPDATE: срабатывает только если статус pending.
  // Два одновременных нажатия "Одобрить" — только один UPDATE найдёт строку.
  const { data: updated, error: updateError } = await supabase
    .from('day_off_requests')
    .update({
      status:           'approved',
      resolved_at:      new Date().toISOString(),
      approved_by_id:   admin?.wsUserId ?? null,
      approved_by_name: admin?.fullName ?? null,
    })
    .eq('id', id)
    .eq('status', 'pending')
    .select('ws_user_id, requested_date')
    .maybeSingle()

  if (updateError) return { success: false, error: 'Не удалось обновить заявку' }
  if (!updated) return { success: false, error: 'Заявка уже обработана или не найдена' }

  const { data: wsUser } = await supabase
    .from('ws_users')
    .select('id, email')
    .eq('id', updated.ws_user_id)
    .single()

  if (wsUser) {
    const { error: absenceError } = await supabase
      .from('ws_user_absences')
      .insert({
        user_id:      wsUser.id,
        user_email:   wsUser.email,
        absence_type: 'day_off',
        absence_date: updated.requested_date,
        synced_at:    new Date().toISOString(),
      })
    if (absenceError && !absenceError.message.includes('duplicate')) {
      console.error('approveDayOffRequest: ws_user_absences insert failed:', absenceError.message)
    }
  }

  revalidatePath('/admin/day-off')
  revalidatePath('/day-off')
  return { success: true }
}

export async function rejectDayOffRequest(
  input: RejectDayOffInput
): Promise<{ success: true } | { success: false; error: string }> {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) return { success: false, error: 'Нет прав' }

  const parsed = rejectDayOffSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message }

  const [admin, supabase] = [await getCurrentUser(), createSupabaseAdminClient()]

  // Только pending-заявки можно отклонить — approved трогать нельзя
  const { data: updated, error } = await supabase
    .from('day_off_requests')
    .update({
      status:           'rejected',
      resolved_at:      new Date().toISOString(),
      rejection_reason: parsed.data.rejection_reason ?? null,
      rejected_by_id:   admin?.wsUserId ?? null,
      rejected_by_name: admin?.fullName ?? null,
    })
    .eq('id', parsed.data.id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()

  if (error) return { success: false, error: 'Не удалось отклонить заявку' }
  if (!updated) return { success: false, error: 'Заявка уже обработана или не найдена' }

  revalidatePath('/admin/day-off')
  revalidatePath('/day-off')
  return { success: true }
}

