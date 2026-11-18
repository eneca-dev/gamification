'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createSupabaseAdminClient } from '@/config/supabase'
import { canUseRoulette } from '@/config/roulette'
import { getCurrentUser } from '@/modules/auth'
import { checkIsAdmin } from '@/modules/admin/checkIsAdmin'
import { readUserBalance } from '@/modules/shop/balance'
import { refreshBalanceAfterCommit } from '@/modules/shop/balance-cache'
import type { ActionResult } from '@/modules/cache'

import { getRouletteEnabled } from './queries'
import { signConfirmation, verifyConfirmation } from './confirmation'
import { periodSchema, rouletteStateSchema, spinResponseSchema, spinResultSchema } from './types'
import type { Confirmation, RouletteState, SpinResponse, SpinResult } from './types'

const errors: Record<string, string> = {
  roulette_disabled: 'Рулетка временно выключена',
  roulette_no_balance: 'Для хода нужен положительный баланс',
  roulette_balance_changed: 'Баланс изменился. Подтвердите новую сумму',
  roulette_period_changed: 'Начался новый месяц. Подтвердите ход заново',
  roulette_numeric_limit: 'Ход недоступен: сумма или курс выходит за допустимые границы учёта',
  roulette_user_missing: 'Сотрудник не найден',
  roulette_invalid_request: 'Неверное подтверждение хода',
}
const unavailable = { success: false as const, error: 'Не удалось загрузить рулетку', code: 'ROULETTE_UNAVAILABLE' }
const unknownOutcome = { success: false as const, error: 'Результат пока неизвестен. Восстановите прежний ход', code: 'ROULETTE_UNKNOWN' }



export async function getRouletteStateAction(): Promise<ActionResult<RouletteState>> {
  const user = await getCurrentUser()
  if (!user?.wsUserId) return { success: false, error: 'Войдите в систему', code: 'UNAUTHORIZED' }
  try {
    const { data, error } = await createSupabaseAdminClient().rpc('get_roulette_state', { p_user_id: user.wsUserId })
    const parsed = rouletteStateSchema.safeParse(data)
    return error || !parsed.success ? unavailable : { success: true, data: { ...parsed.data, enabled: parsed.data.enabled && canUseRoulette(user) } }
  } catch { return unavailable }
}

export async function prepareRouletteAction(): Promise<ActionResult<Confirmation>> {
  const user = await getCurrentUser()
  if (!user?.wsUserId) return { success: false, error: 'Войдите в систему', code: 'UNAUTHORIZED' }
  if (user.isImpersonating) return { success: false, error: 'Ходы при подмене пользователя запрещены', code: 'IMPERSONATION' }
  try {
    const state = await getRouletteStateAction()
    if (!state.success) return state
    if (state.data.result) return { success: false, error: 'Ход этого месяца уже выполнен', code: 'ALREADY_PLAYED' }
    if (!state.data.enabled) return { success: false, error: errors.roulette_disabled, code: 'roulette_disabled' }
    const balance = await readUserBalance(user.wsUserId)
    if (balance <= 0) return { success: false, error: errors.roulette_no_balance, code: 'roulette_no_balance' }
    const operationId = randomUUID()
    const period = state.data.period
    const token = signConfirmation({ purpose: 'roulette-confirmation-v1', userId: user.wsUserId, operationId, period, balance })
    return { success: true, data: { token, operationId, period, balance } }
  } catch { return { success: false, error: 'Не удалось подготовить подтверждение. Ход не отправлен', code: 'CONFIRMATION_UNAVAILABLE' } }
}

export async function spinRouletteAction(input: unknown): Promise<ActionResult<SpinResponse>> {
  const parsed = z.object({ token: z.string().min(1).max(4096) }).safeParse(input)
  if (!parsed.success) return { success: false, error: errors.roulette_invalid_request, code: 'roulette_invalid_request' }
  const user = await getCurrentUser()
  if (!user?.wsUserId) return { success: false, error: 'Войдите в систему', code: 'UNAUTHORIZED' }
  if (user.isImpersonating) return { success: false, error: 'Ходы при подмене пользователя запрещены', code: 'IMPERSONATION' }
  let confirmation
  try { confirmation = verifyConfirmation(parsed.data.token, user.wsUserId) }
  catch { return { success: false, error: 'Не удалось проверить подтверждение', code: 'CONFIRMATION_UNAVAILABLE' } }
  if (!confirmation) return { success: false, error: errors.roulette_invalid_request, code: 'roulette_invalid_request' }

  try {
    const { data, error } = await createSupabaseAdminClient().rpc('spin_roulette', {
      p_user_id: user.wsUserId, p_period: confirmation.period,
      p_operation_id: confirmation.operationId, p_expected_balance: confirmation.balance,
    })
    if (error) {
      // Only explicit database business rejections establish that this attempt did not commit.
      const message = error.code === 'P0001' ? errors[error.message] : undefined
      return message ? { success: false, error: message, code: error.message } : unknownOutcome
    }
    const result = spinResponseSchema.safeParse(data)
    if (!result.success || result.data.result.period !== confirmation.period) return unknownOutcome
    if (!result.data.replayed && (result.data.result.operationId !== confirmation.operationId || result.data.result.balanceBefore !== confirmation.balance)) return unknownOutcome
    refreshBalanceAfterCommit(user.wsUserId)
    return { success: true, data: result.data }
  } catch { return unknownOutcome }
}

export async function recoverRouletteAction(input: unknown): Promise<ActionResult<SpinResult | null>> {
  const parsed = z.object({ period: periodSchema }).safeParse(input)
  if (!parsed.success) return { success: false, error: 'Неверный период', code: 'INVALID_PERIOD' }
  const user = await getCurrentUser()
  if (!user?.wsUserId) return { success: false, error: 'Войдите в систему', code: 'UNAUTHORIZED' }
  try {
    const { data, error } = await createSupabaseAdminClient().rpc('get_roulette_result', {
      p_user_id: user.wsUserId, p_period: parsed.data.period,
    })
    if (error) return unknownOutcome
    if (data === null) return { success: true, data: null } // Not evidence an in-flight attempt failed.
    const result = spinResultSchema.safeParse(data)
    if (!result.success || result.data.period !== parsed.data.period) return unknownOutcome
    refreshBalanceAfterCommit(user.wsUserId)
    return { success: true, data: result.data }
  } catch { return unknownOutcome }
}

export async function setRouletteEnabledAction(input: unknown): Promise<ActionResult<boolean>> {
  const parsed = z.object({ enabled: z.boolean() }).safeParse(input)
  if (!parsed.success) return { success: false, error: 'Неверный запрос' }
  const user = await getCurrentUser()
  if (user?.isImpersonating || !await checkIsAdmin()) return { success: false, error: 'Доступ запрещён' }
  const { data, error } = await createSupabaseAdminClient().from('roulette_settings')
    .update({ enabled: parsed.data.enabled }).eq('singleton', true).select('enabled').single()
  if (error || !data) return { success: false, error: 'Не удалось изменить выключатель' }
  try { revalidatePath('/store') } catch (error) { console.error('Roulette navigation refresh failed:', error) }
  return { success: true, data: data.enabled }
}

export async function getRouletteSettingsAction(): Promise<ActionResult<boolean>> {
  if (!await checkIsAdmin()) return { success: false, error: 'Доступ запрещён' }
  const enabled = await getRouletteEnabled()
  return enabled === null ? { success: false, error: 'Настройки недоступны' } : { success: true, data: enabled }
}
