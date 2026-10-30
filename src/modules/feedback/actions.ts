'use server'

import { revalidatePath } from 'next/cache'

import { createSupabaseAdminClient } from '@/config/supabase'
import { airtableCreateRecord } from '@/config/airtable'
import { getCurrentUser } from '@/modules/auth'
import type { ActionResult } from '@/modules/cache'

import { FeedbackSchema } from './types'
import type { AppealStatus, FeedbackInput } from './types'
import { sendAppealToTeams, sendFeedbackToTeams } from './teams'

const AIRTABLE_TABLE_ID = 'tblchPw2DdhHkD0FD'

function formatDateHuman(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

function buildAppealHeader(sortedDates: string[], txCount: number): string {
  const hasDays = sortedDates.length > 0
  const hasTx = txCount > 0

  if (hasDays && hasTx) {
    const days = sortedDates.length === 1
      ? formatDateHuman(sortedDates[0])
      : `${formatDateHuman(sortedDates[0])}—${formatDateHuman(sortedDates[sortedDates.length - 1])} (${sortedDates.length} дн.)`
    return `Обжалование: ${days} + ${txCount} оп.`
  }
  if (hasDays) {
    return sortedDates.length === 1
      ? `Обжалование списания за ${formatDateHuman(sortedDates[0])}`
      : `Обжалование списания за ${formatDateHuman(sortedDates[0])}—${formatDateHuman(sortedDates[sortedDates.length - 1])} (${sortedDates.length} дн.)`
  }
  return `Обжалование ${txCount} ${txCount === 1 ? 'операции' : 'операций'}`
}

interface AppealSumResult {
  totalCoins: number
  txDatesFromIds: string[]
}

/**
 * Сумма списания по комбинированной выборке дней + ID транзакций.
 * Дедупликация: если транзакция попадает в выбранный день, второй раз её не считаем.
 */
async function computeAppealSum(
  userId: string,
  dates: string[],
  transactionIds: string[]
): Promise<AppealSumResult> {
  const supabase = createSupabaseAdminClient()

  // Для ws-событий event_date сдвинут +1 триггером trg_fix_ws_event_date,
  // поэтому расширяем диапазон дней на день вперёд.
  const expandedDates = new Set<string>()
  for (const d of dates) {
    expandedDates.add(d)
    const next = new Date(d + 'T00:00:00Z')
    next.setUTCDate(next.getUTCDate() + 1)
    expandedDates.add(next.toISOString().slice(0, 10))
  }

  const includedTxIds = new Set<string>()
  let total = 0

  // Шаг 1: суммируем все отрицательные транзакции в выбранных днях
  if (expandedDates.size > 0) {
    const { data } = await supabase
      .from('gamification_transactions')
      .select('id, coins, event_date')
      .eq('user_id', userId)
      .in('event_date', Array.from(expandedDates))
      .lt('coins', 0)
    for (const row of data ?? []) {
      includedTxIds.add(row.id as string)
      total += row.coins as number
    }
  }

  // Шаг 2: подтягиваем явно выбранные транзакции (которых ещё нет) и считаем их coins + event_date
  const txDatesFromIds: string[] = []
  if (transactionIds.length > 0) {
    const { data } = await supabase
      .from('gamification_transactions')
      .select('id, coins, event_date')
      .eq('user_id', userId)
      .in('id', transactionIds)
    for (const row of data ?? []) {
      const id = row.id as string
      const eventDate = row.event_date as string | null
      if (eventDate) txDatesFromIds.push(eventDate)
      if (!includedTxIds.has(id)) {
        includedTxIds.add(id)
        total += row.coins as number
      }
    }
  }

  return { totalCoins: total, txDatesFromIds }
}

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

  // Общая часть Airtable + Supabase
  let airtableId: string | null = null
  const airtableFields: Record<string, unknown> = {
    type: data.type,
    user_name: user.fullName,
    user_email: user.email,
    user_department: user.department ?? '',
    user_team: user.team ?? '',
    status: 'new',
  }

  const supabaseRow: Record<string, unknown> = {
    type: data.type,
    image_urls: data.image_urls,
    user_id: user.id,
    ws_user_id: user.wsUserId ?? null,
    user_name: user.fullName,
    user_email: user.email ?? null,
    user_department: user.department ?? null,
    user_team: user.team ?? null,
  }

  let totalCoins = 0

  let appealTxDatesFromIds: string[] = []

  if (data.type === 'appeal') {
    const wsUserId = user.wsUserId
    if (!wsUserId) {
      return { success: false, error: 'Профиль не связан с ws_users' }
    }
    if (data.dates.length === 0 && data.transaction_ids.length === 0) {
      return { success: false, error: 'Выберите хотя бы один день или одну операцию' }
    }

    const sumResult = await computeAppealSum(wsUserId, data.dates, data.transaction_ids)
    totalCoins = sumResult.totalCoins
    appealTxDatesFromIds = sumResult.txDatesFromIds

    const sortedDates = [...data.dates].sort()
    const txCount = data.transaction_ids.length
    const header = buildAppealHeader(sortedDates, txCount)

    airtableFields.header = header
    airtableFields.description = data.description
    airtableFields.appeal_dates = sortedDates.join(', ')
    airtableFields.appeal_transaction_ids = data.transaction_ids.join(', ')
    airtableFields.appeal_total_coins = totalCoins
    if (data.task_url) airtableFields.appeal_task_url = data.task_url
    if (data.image_urls.length > 0) {
      airtableFields.attachments = data.image_urls.map((url) => ({ url }))
    }

    supabaseRow.header = header
    supabaseRow.description = data.description
    supabaseRow.appeal_dates = sortedDates.length > 0 ? sortedDates : null
    supabaseRow.appeal_transaction_ids = data.transaction_ids.length > 0 ? data.transaction_ids : null
    supabaseRow.appeal_total_coins = totalCoins
    supabaseRow.appeal_task_url = data.task_url || null
    supabaseRow.status = 'new'
  } else {
    airtableFields.header = data.header
    if (data.description) airtableFields.description = data.description
    if (data.expected_behavior) airtableFields.expected_behavior = data.expected_behavior
    if (data.image_urls.length > 0) {
      airtableFields.attachments = data.image_urls.map((url) => ({ url }))
    }

    supabaseRow.header = data.header
    supabaseRow.description = data.description ?? null
    supabaseRow.expected_behavior = data.expected_behavior ?? null
  }

  try {
    const record = await airtableCreateRecord(AIRTABLE_TABLE_ID, airtableFields)
    airtableId = record.id
  } catch (err) {
    console.error('Airtable create failed:', err)
    // Не блокируем: зеркало в Supabase всё равно сохраняем
  }

  const supabase = createSupabaseAdminClient()
  const { data: row, error } = await supabase
    .from('feedback')
    .insert({ ...supabaseRow, airtable_id: airtableId })
    .select('id')
    .single()

  if (error) {
    return { success: false, error: 'Ошибка сохранения. Попробуйте снова' }
  }

  revalidatePath('/admin/feedback')
  if (data.type === 'appeal') {
    revalidatePath('/admin/appeals')
    revalidatePath(`/admin/corrections/${user.wsUserId}`)
  }

  try {
    if (data.type === 'appeal') {
      await sendAppealToTeams({
        id: row.id,
        dates: [...data.dates].sort(),
        tx_count: data.transaction_ids.length,
        tx_dates: appealTxDatesFromIds,
        description: data.description,
        task_url: data.task_url || undefined,
        image_urls: data.image_urls,
        total_coins: totalCoins,
        user_name: user.fullName,
        user_email: user.email,
        user_department: user.department ?? null,
        user_team: user.team ?? null,
      })
    } else {
      await sendFeedbackToTeams({
        ...data,
        id: row.id,
        user_name: user.fullName,
        user_email: user.email,
      })
    }
  } catch (err) {
    console.error('Teams notification failed:', err instanceof Error ? err.message : 'unknown error')
  }

  return { success: true, data: { id: row.id } }
}

export async function deleteFeedbackItems(ids: string[]): Promise<ActionResult<null>> {
  const user = await getCurrentUser()
  if (!user?.isAdmin) return { success: false, error: 'Недостаточно прав' }

  if (ids.length === 0) return { success: true, data: null }

  const supabase = createSupabaseAdminClient()
  const { error } = await supabase.from('feedback').delete().in('id', ids)

  if (error) return { success: false, error: 'Ошибка удаления' }

  revalidatePath('/admin/feedback')
  revalidatePath('/admin/appeals')
  return { success: true, data: null }
}

export async function updateAppealStatus(
  id: string,
  status: AppealStatus,
  comment: string | null
): Promise<ActionResult<null>> {
  const user = await getCurrentUser()
  if (!user?.isAdmin) return { success: false, error: 'Недостаточно прав' }

  const supabase = createSupabaseAdminClient()
  const { data: existing, error: readErr } = await supabase
    .from('feedback')
    .select('ws_user_id, type')
    .eq('id', id)
    .single()

  if (readErr || !existing) return { success: false, error: 'Обжалование не найдено' }
  if (existing.type !== 'appeal') return { success: false, error: 'Это не обжалование' }

  const { error } = await supabase
    .from('feedback')
    .update({
      status,
      review_comment: comment,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq('id', id)

  if (error) return { success: false, error: 'Ошибка обновления статуса' }

  revalidatePath('/admin/appeals')
  revalidatePath('/admin/feedback')
  const wsUserId = existing.ws_user_id as string | null
  if (wsUserId) revalidatePath(`/admin/corrections/${wsUserId}`)
  return { success: true, data: null }
}
