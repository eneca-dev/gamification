import { createSupabaseServerClient, createSupabaseAdminClient } from '@/config/supabase'

import type { ShopCategory, ShopProductWithCategory, ShopOrderWithDetails } from './types'

export async function getUserBalance(wsUserId: string): Promise<number> {
  const supabase = createSupabaseAdminClient()

  const { data } = await supabase
    .from('gamification_balances')
    .select('total_coins')
    .eq('user_id', wsUserId)
    .single()

  return data?.total_coins ?? 0
}

export async function getCategories(): Promise<ShopCategory[]> {
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from('shop_categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getAllCategories(): Promise<ShopCategory[]> {
  const supabase = createSupabaseAdminClient()

  const { data, error } = await supabase
    .from('shop_categories')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getProducts(categorySlug?: string): Promise<ShopProductWithCategory[]> {
  const supabase = await createSupabaseServerClient()

  let query = supabase
    .from('shop_products')
    .select(`
      *,
      category:shop_categories!category_id ( name, slug, is_physical, is_active )
    `)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (categorySlug) {
    query = query.eq('category.slug', categorySlug)
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)

  // Фильтруем товары с неактивными категориями
  return (data ?? [])
    .filter((p) => p.category?.is_active)
    .map((p) => ({
      ...p,
      category: Array.isArray(p.category) ? p.category[0] : p.category,
    })) as ShopProductWithCategory[]
}

export async function getAllProducts(): Promise<ShopProductWithCategory[]> {
  const supabase = createSupabaseAdminClient()

  const { data, error } = await supabase
    .from('shop_products')
    .select(`
      *,
      category:shop_categories!category_id ( name, slug, is_physical, is_active )
    `)
    .order('sort_order', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []).map((p) => ({
    ...p,
    category: Array.isArray(p.category) ? p.category[0] : p.category,
  })) as ShopProductWithCategory[]
}

export async function getProductById(id: string): Promise<ShopProductWithCategory | null> {
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from('shop_products')
    .select(`
      *,
      category:shop_categories!category_id ( name, slug, is_physical, is_active )
    `)
    .eq('id', id)
    .single()

  if (error || !data) return null

  return {
    ...data,
    category: Array.isArray(data.category) ? data.category[0] : data.category,
  } as ShopProductWithCategory
}

export async function getUserOrders(wsUserId: string): Promise<ShopOrderWithDetails[]> {
  const supabase = createSupabaseAdminClient()

  const { data, error } = await supabase
    .from('shop_orders')
    .select(`
      *,
      product:shop_products!product_id ( name, emoji, image_url ),
      transaction:gamification_transactions!transaction_id ( coins )
    `)
    .eq('user_id', wsUserId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    const product = Array.isArray(row.product) ? row.product[0] : row.product
    const transaction = Array.isArray(row.transaction) ? row.transaction[0] : row.transaction
    return {
      id: row.id,
      user_id: row.user_id,
      product_id: row.product_id,
      status: row.status,
      status_changed_by: row.status_changed_by,
      status_changed_at: row.status_changed_at,
      transaction_id: row.transaction_id,
      refund_transaction_id: row.refund_transaction_id,
      note: row.note,
      created_at: row.created_at,
      product: {
        name: product?.name ?? 'Удалённый товар',
        emoji: product?.emoji ?? null,
        image_url: product?.image_url ?? null,
      },
      coins_spent: Math.abs(transaction?.coins ?? 0),
    }
  })
}
