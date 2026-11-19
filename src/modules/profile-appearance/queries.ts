import 'server-only'
import { createSupabaseAdminClient } from '@/config/supabase'
import { getCurrentRate } from '@/modules/shop/queries'
import { computePriceCrystals } from '@/modules/shop/types'
import { DEFAULT_EQUIPMENT, bimoRenderable, parseRigArt } from '@/modules/bimo-rig'
import type { BimoArtMap, BimoSlot } from '@/modules/bimo-rig'
import type { BimoState } from './types'

// Коллекция открыта во всех окружениях: релизный флаг снят, переменная
// BIMO_V2_ENABLED больше ни на что не влияет. Чтобы снова закрыть Бимо,
// верните сюда проверку окружения.
export const bimoEnabled = (): boolean => true

export async function getBimoState(userId: string): Promise<BimoState> {
  const preview = process.env.NODE_ENV === 'development'
  if (!bimoEnabled()) return { enabled: false, preview: false, items: [], equipment: { ...DEFAULT_EQUIPMENT }, catalogArt: {} }
  const db = createSupabaseAdminClient()
  const [catalog, orders, equipped, rate] = await Promise.all([
    db.from('bimo_catalog').select('asset_key,slot,product_id,is_released,art,art_version,product:shop_products!product_id(name,description,emoji,cost_byn,coefficient,price_adjustment_crystals,is_active,is_coming_soon,effect,comment_required,comment_label,comment_placeholder,category:shop_categories!category_id(slug,is_active,is_physical,is_countable))'),
    db.from('shop_orders').select('id,product_id').eq('user_id', userId).eq('status', 'fulfilled').is('refund_transaction_id', null),
    db.from('bimo_equipment').select('slot,asset_key,source_order_id').eq('user_id', userId),
    getCurrentRate(),
  ])
  if (catalog.error || orders.error || equipped.error) throw new Error('Не удалось загрузить гардероб')
  const ownedOrders = new Map((orders.data ?? []).map(o => [o.id as string, o.product_id as string]))
  const ownedProducts = new Set(ownedOrders.values())
  const equipment = { ...DEFAULT_EQUIPMENT }
  const items: BimoState['items'] = []
  const catalogArt: BimoArtMap = {}
  for (const row of catalog.data ?? []) {
    // Графику из каталога имеют аксессуары, одежда и загруженные фоны.
    const art = parseRigArt(row.art, row.slot, row.art_version)
    if (art) catalogArt[row.asset_key] = art
  }
  for (const row of catalog.data ?? []) {
    const product = Array.isArray(row.product) ? row.product[0] : row.product
    if (!product) continue
    const category = Array.isArray(product.category) ? product.category[0] : product.category
    const slot = row.slot as BimoSlot
    if (!(slot in equipment)) continue
    const supported = bimoRenderable(row.asset_key, catalogArt)
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
      commentRequired: product.comment_required === true,
      commentLabel: product.comment_label ?? null,
      commentPlaceholder: product.comment_placeholder ?? null,
    })
  }
  return { enabled: true, preview, items, equipment, catalogArt }
}
