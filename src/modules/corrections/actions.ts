'use server'

import { revalidatePath } from 'next/cache'

import { createSupabaseAdminClient } from '@/config/supabase'
import type { ActionResult } from '@/modules/cache'
import { checkIsAdmin } from '@/modules/admin/checkIsAdmin'
import { getCurrentUser } from '@/modules/auth'

import { correctionInputSchema } from './types'
import type { CorrectionInput, CorrectionLog, CorrectionUserDetail } from './types'
import { getCorrectionUserDetail } from './queries'

// ============================================================
// Общая обёртка: валидация + авторизация + вызов RPC
// ============================================================

interface RunCorrectionOptions {
  dryRun: boolean
  adminWsUserId: string | null
}

async function runCorrectionRpc(
  input: CorrectionInput,
  { dryRun, adminWsUserId }: RunCorrectionOptions,
): Promise<CorrectionLog> {
  const supabase = createSupabaseAdminClient()

  if (input.correctionType === 'fix_ws_day') {
    const { data, error } = await supabase.rpc('fn_correction_fix_ws_day', {
      p_user_id: input.targetUserId,
      p_dates: input.dates,
      p_mode: input.mode,
      p_absence_type: input.absenceType,
      p_reason: input.reason,
      p_dry_run: dryRun,
      p_admin_id: adminWsUserId,
    })
    if (error) throw new Error(error.message)
    return data as CorrectionLog
  }

  if (input.correctionType === 'fix_revit_day') {
    const { data, error } = await supabase.rpc('fn_correction_fix_revit_day', {
      p_user_id: input.targetUserId,
      p_dates: input.dates,
      p_mode: input.mode,
      p_plugin_name: input.pluginName,
      p_reason: input.reason,
      p_dry_run: dryRun,
      p_admin_id: adminWsUserId,
    })
    if (error) throw new Error(error.message)
    return data as CorrectionLog
  }

  if (input.correctionType === 'delete_transaction') {
    const { data, error } = await supabase.rpc('fn_correction_delete_transaction', {
      p_transaction_id: input.transactionId,
      p_reason: input.reason,
      p_dry_run: dryRun,
    })
    if (error) throw new Error(error.message)
    return data as CorrectionLog
  }

  // add_transaction
  const { data, error } = await supabase.rpc('fn_correction_add_transaction', {
    p_user_id: input.targetUserId,
    p_event_type: input.eventType,
    p_event_date: input.eventDate,
    p_coins_override: input.coinsOverride,
    p_details: input.description ? { description: input.description } : {},
    p_reason: input.reason,
    p_dry_run: dryRun,
    p_admin_id: adminWsUserId,
  })
  if (error) throw new Error(error.message)
  return data as CorrectionLog
}

// ============================================================
// Preview — ничего в БД не меняет, запись в журнал не пишет.
// ============================================================

export async function previewCorrection(rawInput: unknown): Promise<ActionResult<CorrectionLog>> {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) return { success: false, error: 'Доступ запрещён' }

  const parsed = correctionInputSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Невалидные данные' }
  }

  const currentUser = await getCurrentUser()
  const adminWsUserId = currentUser?.wsUserId ?? null

  try {
    const log = await runCorrectionRpc(parsed.data, { dryRun: true, adminWsUserId })
    return { success: true, data: log }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка RPC' }
  }
}

// ============================================================
// Apply — применяет изменения и пишет в журнал admin_corrections.
// ============================================================

export async function applyCorrection(rawInput: unknown): Promise<ActionResult<CorrectionLog>> {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) return { success: false, error: 'Доступ запрещён' }

  const parsed = correctionInputSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Невалидные данные' }
  }
  const input = parsed.data

  const currentUser = await getCurrentUser()
  const adminWsUserId = currentUser?.wsUserId ?? null

  const supabase = createSupabaseAdminClient()

  // Запись в журнал (running) до вызова RPC — чтобы остался след, даже если упадёт.
  const { data: journalRow, error: journalErr } = await supabase
    .from('admin_corrections')
    .insert({
      correction_type: input.correctionType,
      status: 'running',
      admin_user_id: adminWsUserId,
      target_user_id: input.targetUserId,
      reason: input.reason,
      input_payload: toJsonInput(input),
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (journalErr || !journalRow) {
    return { success: false, error: journalErr?.message ?? 'Не удалось создать запись в журнале' }
  }

  const journalId = journalRow.id as string
  let log: CorrectionLog
  try {
    log = await runCorrectionRpc(input, { dryRun: false, adminWsUserId })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка RPC'
    await supabase
      .from('admin_corrections')
      .update({ status: 'failed', error_message: message, finished_at: new Date().toISOString() })
      .eq('id', journalId)
    return { success: false, error: message }
  }

  const finalStatus = log.status === 'ok' ? 'applied' : 'failed'

  await supabase
    .from('admin_corrections')
    .update({
      status: finalStatus,
      executed_steps: log.steps,
      error_message: log.error ?? null,
      finished_at: new Date().toISOString(),
    })
    .eq('id', journalId)

  // Рефреш 6 топовых матвью — после успешного применения любого сценария.
  // Все сценарии могут задеть топы: green_day/revit_using_plugins/бонусы стрика.
  if (finalStatus === 'applied') {
    await supabase.rpc('fn_refresh_ranking_views')
  }

  revalidatePath('/admin/corrections')
  revalidatePath(`/admin/corrections/${input.targetUserId}`)

  return { success: true, data: log }
}

// ============================================================
// Чтение детали пользователя (для client-side обновления после apply)
// ============================================================

export async function getCorrectionUserDetailAction(
  userId: string,
): Promise<ActionResult<CorrectionUserDetail>> {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) return { success: false, error: 'Доступ запрещён' }

  try {
    const detail = await getCorrectionUserDetail(userId)
    if (!detail) return { success: false, error: 'Пользователь не найден' }
    return { success: true, data: detail }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка чтения' }
  }
}

// ============================================================
// Внутреннее
// ============================================================

function toJsonInput(input: CorrectionInput): Record<string, unknown> {
  // input уже валиден по zod; сохраняем как есть, чтобы в журнале были все поля сценария.
  return { ...input }
}
