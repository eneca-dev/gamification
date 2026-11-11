import 'server-only'
import { createSupabaseAdminClient } from '@/config/supabase'
import { getCurrentRate } from '@/modules/shop/queries'
import { computePriceCrystals } from '@/modules/shop/types'
import { BIMO_RENDERABLE, DEFAULT_EQUIPMENT, type BimoSlot, type BimoState } from './types'

export const bimoEnabled = () => process.env.NODE_ENV === 'development' || process.env.BIMO_V2_ENABLED === 'true'

export async function getBimoState(userId: string): Promise<BimoState> {
  const preview = process.env.NODE_ENV === 'development'
  if (!bimoEnabled()) return { enabled: false, preview: false, items: [], equipment: { ...DEFAULT_EQUIPMENT } }
  const db = createSupabaseAdminClient()
  const [catalog, orders, equipped, rate] = await Promise.all([
    db.from('bimo_catalog').select('asset_key,slot,product_id,is_released,product:shop_products!product_id(name,description,emoji,cost_byn,coefficient,price_adjustment_crystals,is_active,is_coming_soon,effect,category:shop_categories!category_id(slug,is_active,is_physical,is_countable))'),
    db.from('shop_orders').select('id,product_id').eq('user_id', userId).eq('status', 'fulfilled').is('refund_transaction_id', null),
    db.from('bimo_equipment').select('slot,asset_key,source_order_id').eq('user_id', userId),
    getCurrentRate(),
  ])
  if (catalog.error || orders.error || equipped.error) throw new Error('Не удалось загрузить гардероб')
  const ownedOrders = new Map((orders.data ?? []).map(o => [o.id as string, o.product_id as string]))
  const ownedProducts = new Set(ownedOrders.values())
  const equipment = { ...DEFAULT_EQUIPMENT }
  const items: BimoState['items'] = []
  for (const row of catalog.data ?? []) {
    const product = Array.isArray(row.product) ? row.product[0] : row.product
    if (!product) continue
    const category = Array.isArray(product.category) ? product.category[0] : product.category
    const slot = row.slot as BimoSlot
    if (!(slot in equipment)) continue
    const supported = BIMO_RENDERABLE.has(row.asset_key)
    const owned = ownedProducts.has(row.product_id)
    const released = row.is_released
    const purchasable = released && supported && product.is_active && !product.is_coming_soon
      && category?.is_active && !category.is_physical && !category.is_countable
      && category.slug === 'artifact' && product.effect === `bimo:${row.asset_key}`
    // The source order must belong to this user AND exactly this product.
    const selection = equipped.data?.find(e => e.slot === slot && e.asset_key === row.asset_key)
    if (released && supported && selection && ownedOrders.get(selection.source_order_id) === row.product_id) {
      equipment[slot] = row.asset_key
    }
    if (!preview && (!released || (!purchasable && !owned))) continue
    items.push({
      assetKey: row.asset_key, slot, productId: row.product_id,
      name: product.name, description: product.description, emoji: product.emoji,
      price: computePriceCrystals(Number(product.cost_byn), Number(product.coefficient), rate, Number(product.price_adjustment_crystals)),
      owned, purchasable: Boolean(purchasable), released, supported,
    })
  }
  return { enabled: true, preview, items, equipment }
}
