'use server'

import { z } from 'zod'
import { revalidatePath, revalidateTag } from 'next/cache'
import { getCurrentUser } from '@/modules/auth'
import { createSupabaseAdminClient } from '@/config/supabase'
import { balanceTag } from '@/modules/shop/queries'
import type { ActionResult } from '@/modules/cache'
import { bimoEnabled, getBimoState } from './queries'
import { BIMO_RENDERABLE, BIMO_SLOTS, type BimoState } from './types'

const purchaseSchema = z.object({ productId: z.string().uuid(), comment: z.string().trim().max(1000).optional() })
const equipSchema = z.object({ slot: z.enum(BIMO_SLOTS), assetKey: z.string().max(100).nullable() })
const errors: Record<string, string> = {
  bimo_item_unavailable: 'Эта вещь пока недоступна',
  bimo_already_owned: 'Эта вещь уже куплена или заказ ещё обрабатывается',
  bimo_not_owned: 'У вас нет действующей покупки этой вещи',
  bimo_user_not_found: 'Пользователь недоступен',
  bimo_invalid_slot: 'Неверный раздел гардероба',
}
function message(raw: string) {
  if (raw.includes('Недостаточно')) return 'Недостаточно кристаллов'
  if (raw.includes('comment_required')) return 'Для покупки нужен комментарий'
  return Object.entries(errors).find(([key]) => raw.includes(key))?.[1] ?? 'Не удалось выполнить действие. Попробуйте ещё раз'
}

export async function getBimoStateAction(): Promise<ActionResult<BimoState>> {
  const user = await getCurrentUser()
  if (!user?.wsUserId) return { success: false, error: 'Войдите в систему' }
  try { return { success: true, data: await getBimoState(user.wsUserId) } }
  catch { return { success: false, error: 'Не удалось загрузить гардероб' } }
}

export async function purchaseBimoItem(input: unknown): Promise<ActionResult<null>> {
  const parsed = purchaseSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Неверный запрос' }
  const user = await getCurrentUser()
  if (!user?.wsUserId) return { success: false, error: 'Войдите в систему' }
  if (!bimoEnabled()) return { success: false, error: 'Коллекция пока недоступна' }
  const db = createSupabaseAdminClient()
  const { data: item, error: lookupError } = await db.from('bimo_catalog').select('asset_key').eq('product_id', parsed.data.productId).maybeSingle()
  if (lookupError || !item || !BIMO_RENDERABLE.has(item.asset_key)) return { success: false, error: 'Образ пока не готов' }
  const { error } = await db.rpc('purchase_bimo_item', {
    p_product_id: parsed.data.productId, p_user_id: user.wsUserId, p_user_comment: parsed.data.comment ?? null,
  })
  if (error) return { success: false, error: message(error.message) }
  revalidateTag(balanceTag(user.wsUserId), 'max')
  revalidatePath('/store'); revalidatePath('/store/orders'); revalidatePath('/')
  return { success: true, data: null }
}

export async function equipBimoItem(input: unknown): Promise<ActionResult<null>> {
  const parsed = equipSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Неверный запрос' }
  const user = await getCurrentUser()
  if (!user?.wsUserId) return { success: false, error: 'Войдите в систему' }
  if (!bimoEnabled()) return { success: false, error: 'Гардероб пока недоступен' }
  if (parsed.data.assetKey !== null && !BIMO_RENDERABLE.has(parsed.data.assetKey)) return { success: false, error: 'Образ пока не готов' }
  const { error } = await createSupabaseAdminClient().rpc('equip_bimo_item', {
    p_user_id: user.wsUserId, p_slot: parsed.data.slot, p_asset_key: parsed.data.assetKey,
  })
  if (error) return { success: false, error: message(error.message) }
  revalidatePath('/store'); revalidatePath('/')
  return { success: true, data: null }
}
