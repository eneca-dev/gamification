'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/modules/auth'
import { createSupabaseAdminClient } from '@/config/supabase'
import { refreshBalanceAfterCommit } from '@/modules/shop/balance-cache'
import { computePriceCrystals } from '@/modules/shop/types'
import type { ActionResult } from '@/modules/cache'
import { BIMO_SLOTS, parseRigArt } from '@/modules/bimo-rig'
import { bimoEnabled, getBimoState } from './queries'
import type { BimoState } from './types'

/** Вещь готова к продаже/надеванию: она либо в коде, либо имеет графику в каталоге. */
async function assetReady(assetKey: string): Promise<boolean> {
  const { data } = await createSupabaseAdminClient()
    .from('bimo_catalog').select('art,slot,art_version').eq('asset_key', assetKey).maybeSingle()
  return Boolean(data && parseRigArt(data.art, data.slot, data.art_version))
}

const purchaseSchema = z.object({
  productId: z.string().uuid(),
  comment: z.string().trim().max(1000).optional(),
  /** Цена, которую видел покупатель. Расхождение с текущей — отказ, а не списание. */
  expectedPrice: z.number().int().positive(),
})
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
  const { data: item, error: lookupError } = await db.from('bimo_catalog')
    .select('asset_key,slot,art,art_version,product:shop_products!product_id(cost_byn,coefficient,price_adjustment_crystals)')
    .eq('product_id', parsed.data.productId).maybeSingle()
  const ready = Boolean(item && parseRigArt(item.art, item.slot, item.art_version))
  if (lookupError || !item || !ready) return { success: false, error: 'Образ пока не готов' }

  // Цена в карточке считается по кэшированному курсу, оплата — по текущему.
  // Сверяем с тем же курсом, который возьмёт функция покупки, и отказываем при
  // расхождении: лучше попросить обновить страницу, чем списать другую сумму.
  const product = Array.isArray(item.product) ? item.product[0] : item.product
  const { data: liveRate, error: rateError } = await db.rpc('current_crystal_rate')
  if (rateError || !product || liveRate === null) return { success: false, error: 'Не удалось проверить цену. Попробуйте ещё раз' }
  const price = computePriceCrystals(Number(product.cost_byn), Number(product.coefficient), Number(liveRate), Number(product.price_adjustment_crystals))
  if (price !== parsed.data.expectedPrice) {
    return { success: false, error: `Цена изменилась и сейчас ${price.toLocaleString('ru-RU')}. Обновите страницу и попробуйте снова` }
  }

  const { error } = await db.rpc('purchase_bimo_item', {
    p_product_id: parsed.data.productId, p_user_id: user.wsUserId, p_user_comment: parsed.data.comment ?? null,
  })
  if (error) return { success: false, error: message(error.message) }
  // Галерея Бимо живёт вкладкой ленты, поэтому обновляется и она.
  refreshBalanceAfterCommit(user.wsUserId, ['/store', '/store/orders', '/', '/activity'])
  return { success: true, data: null }
}

export async function equipBimoItem(input: unknown): Promise<ActionResult<null>> {
  const parsed = equipSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Неверный запрос' }
  const user = await getCurrentUser()
  if (!user?.wsUserId) return { success: false, error: 'Войдите в систему' }
  if (!bimoEnabled()) return { success: false, error: 'Гардероб пока недоступен' }
  if (parsed.data.assetKey !== null && !(await assetReady(parsed.data.assetKey))) return { success: false, error: 'Образ пока не готов' }
  const { error } = await createSupabaseAdminClient().rpc('equip_bimo_item', {
    p_user_id: user.wsUserId, p_slot: parsed.data.slot, p_asset_key: parsed.data.assetKey,
  })
  if (error) return { success: false, error: message(error.message) }
  // Образ виден и в галерее компании, и в сайдбаре, поэтому обновляются все три страницы.
  revalidatePath('/store'); revalidatePath('/'); revalidatePath('/activity')
  return { success: true, data: null }
}
