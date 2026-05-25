'use server'

import { revalidatePath } from 'next/cache'

import { createSupabaseAdminClient } from '@/config/supabase'
import { airtableCreateRecord } from '@/config/airtable'
import { getCurrentUser } from '@/modules/auth'
import type { ActionResult } from '@/modules/cache'

import { FeedbackSchema } from './types'
import type { FeedbackInput } from './types'

const AIRTABLE_TABLE_ID = 'tblchPw2DdhHkD0FD'

export async function submitFeedback(
  input: FeedbackInput
): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Необходима авторизация' }

  const parsed = FeedbackSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? 'Невалидные данные',
    }
  }

  const data = parsed.data

  // Создаём запись в Airtable
  let airtableId: string | null = null
  try {
    const airtableFields: Record<string, unknown> = {
      header: data.header,
      type: data.type,
      user_name: user.fullName,
      user_department: user.department ?? '',
      user_team: user.team ?? '',
      status: 'new',
    }
    if (data.description) airtableFields.description = data.description
    if (data.expected_behavior) airtableFields.expected_behavior = data.expected_behavior
    if (data.image_urls.length > 0) {
      airtableFields.attachments = data.image_urls.map((url) => ({ url }))
    }

    const record = await airtableCreateRecord(AIRTABLE_TABLE_ID, airtableFields)
    airtableId = record.id
  } catch (err) {
    console.error('Airtable create failed:', err)
    // Не блокируем: зеркало в Supabase всё равно сохраняем
  }

  // Зеркалим в Supabase
  const supabase = createSupabaseAdminClient()
  const { data: row, error } = await supabase
    .from('feedback')
    .insert({
      type: data.type,
      header: data.header,
      description: data.description ?? null,
      expected_behavior: data.expected_behavior ?? null,
      image_urls: data.image_urls,
      airtable_id: airtableId,
      user_id: user.id,
      user_name: user.fullName,
      user_department: user.department ?? null,
      user_team: user.team ?? null,
    })
    .select('id')
    .single()

  if (error) {
    return { success: false, error: 'Ошибка сохранения. Попробуйте снова' }
  }

  revalidatePath('/admin/feedback')

  return { success: true, data: { id: row.id } }
}
