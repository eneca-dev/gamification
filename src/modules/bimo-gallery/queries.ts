import 'server-only'

import { createSupabaseAdminClient } from '@/config/supabase'
import { DEFAULT_EQUIPMENT, parseRigArt } from '@/modules/bimo-rig'

import type { BimoArtMap } from '@/modules/bimo-rig'
import type { GalleryEntry, GalleryPage, GalleryWinner } from './types'

interface GalleryRow {
  user_id: string
  first_name: string | null
  last_name: string | null
  email: string
  department_code: string | null
  team: string | null
  outfit: string | null
  accessory: string | null
  background: string | null
  has_look: boolean
  likes: number
  liked_by_me: boolean
}

interface WinnerRow {
  contest_month: string | null
  user_id: string | null
  user_email: string | null
  likes: number | null
}

/** Месяц конкурса считает БД (минское время), чтобы границы совпадали с лайками. */
export async function getBimoMonth(): Promise<string> {
  const { data, error } = await createSupabaseAdminClient().rpc('fn_bimo_month')
  if (error || typeof data !== 'string') throw new Error(error?.message ?? 'bimo_month_unavailable')
  return data
}

async function getLikeLimit(): Promise<number> {
  const { data, error } = await createSupabaseAdminClient().rpc('fn_bimo_like_limit')
  if (error) throw new Error(error.message)
  return Number(data ?? 3)
}

/**
 * Израсходованные лайки считаются по таблице голосов, а не по видимым карточкам:
 * лайк сотруднику, который выпал из галереи, всё равно занимает место в лимите.
 */
async function getUsedLikes(voterId: string | null, month: string): Promise<number> {
  if (!voterId) return 0
  const { count, error } = await createSupabaseAdminClient()
    .from('bimo_likes')
    .select('target_id', { count: 'exact', head: true })
    .eq('voter_id', voterId)
    .eq('contest_month', month)
  if (error) {
    console.error('[bimo-gallery] getUsedLikes:', error.message)
    return 0
  }
  return count ?? 0
}

function toEntry(row: GalleryRow): GalleryEntry {
  return {
    userId: row.user_id,
    firstName: row.first_name ?? '',
    lastName: row.last_name ?? '',
    department: row.department_code,
    team: row.team,
    equipment: {
      ...DEFAULT_EQUIPMENT,
      outfit: row.outfit,
      accessory: row.accessory,
      background: row.background,
    },
    hasLook: row.has_look,
    likes: Number(row.likes ?? 0),
    likedByMe: row.liked_by_me === true,
  }
}

/**
 * Победители закрытых месяцев. Имена берём отдельным запросом: вью победителей
 * построена на событиях и связи с ws_users у неё нет.
 */
async function loadWinners(limit: number): Promise<GalleryWinner[]> {
  const db = createSupabaseAdminClient()
  const { data, error } = await db
    .from('view_bimo_contest_winners')
    .select('contest_month, user_id, user_email, likes')
    .order('contest_month', { ascending: false })
    .limit(limit)
  if (error) {
    console.error('[bimo-gallery] loadWinners:', error.message)
    return []
  }

  const rows = ((data ?? []) as WinnerRow[]).filter((row) => row.contest_month && row.user_id)
  if (rows.length === 0) return []

  const { data: users } = await db
    .from('ws_users')
    .select('id, first_name, last_name, department_code')
    .in('id', rows.map((row) => row.user_id as string))

  const byId = new Map((users ?? []).map((user) => [user.id as string, user]))

  return rows.map((row) => {
    const user = byId.get(row.user_id as string)
    const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ')
    return {
      contestMonth: row.contest_month as string,
      userId: row.user_id as string,
      email: row.user_email ?? '',
      fullName: fullName || (row.user_email ?? 'Сотрудник'),
      department: (user?.department_code as string | null) ?? null,
      likes: Number(row.likes ?? 0),
    }
  })
}

/** Названия и графику вещей берём из каталога, чтобы они не дублировались в коде. */
async function loadCatalog(): Promise<{ labels: Record<string, string>; art: BimoArtMap }> {
  const { data, error } = await createSupabaseAdminClient()
    .from('bimo_catalog')
    .select('asset_key, slot, art, art_version, product:shop_products!product_id(name)')
  if (error) {
    console.error('[bimo-gallery] loadCatalog:', error.message)
    return { labels: {}, art: {} }
  }

  // PostgREST типизирует вложенный товар как массив, по данным приходит объект.
  type Row = { asset_key: string; slot: string; art: unknown; art_version: number; product: { name: string | null } | { name: string | null }[] | null }
  const labels: Record<string, string> = {}
  const art: BimoArtMap = {}
  for (const row of (data ?? []) as unknown as Row[]) {
    const product = Array.isArray(row.product) ? row.product[0] : row.product
    const name = product?.name
    if (name) labels[row.asset_key] = name.replace(/^Бимо\s*·\s*/, '')
    const layers = parseRigArt(row.art, row.slot, row.art_version)
    if (layers) art[row.asset_key] = layers
  }
  return { labels, art }
}

/**
 * Галерея одним RPC: сотрудники, действующие образы и лайки месяца.
 * Без кэша: `liked_by_me` и счётчики должны быть свежими после голосования,
 * а остальные три запроса слишком мелкие, чтобы их кэшировать.
 */
export async function getGalleryPage(viewerId: string | null, winnersLimit = 12): Promise<GalleryPage> {
  const month = await getBimoMonth()
  const db = createSupabaseAdminClient()

  const [gallery, likeLimit, usedLikes, winners, catalog] = await Promise.all([
    db.rpc('fn_bimo_gallery', { p_month: month, p_voter_id: viewerId }),
    getLikeLimit(),
    getUsedLikes(viewerId, month),
    loadWinners(winnersLimit),
    loadCatalog(),
  ])

  if (gallery.error) throw new Error(gallery.error.message)

  const entries = ((gallery.data ?? []) as GalleryRow[]).map(toEntry)

  return {
    month,
    likeLimit,
    usedLikes,
    entries,
    winners,
    lookLabels: catalog.labels,
    catalogArt: catalog.art,
  }
}
