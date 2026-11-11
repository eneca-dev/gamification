import 'server-only'

import { createSupabaseAdminClient } from '@/config/supabase'
import { DEFAULT_EQUIPMENT } from '@/modules/profile-appearance/index.client'

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

/** Подписи вещей берём из каталога, чтобы названия не дублировались в коде. */
async function loadLookLabels(): Promise<Record<string, string>> {
  const { data, error } = await createSupabaseAdminClient()
    .from('bimo_catalog')
    .select('asset_key, product:shop_products!product_id(name)')
  if (error) {
    console.error('[bimo-gallery] loadLookLabels:', error.message)
    return {}
  }

  // PostgREST типизирует вложенный товар как массив, по данным приходит объект.
  type Row = { asset_key: string; product: { name: string | null } | { name: string | null }[] | null }
  const labels: Record<string, string> = {}
  for (const row of (data ?? []) as unknown as Row[]) {
    const product = Array.isArray(row.product) ? row.product[0] : row.product
    const name = product?.name
    if (name) labels[row.asset_key] = name.replace(/^Бимо\s*·\s*/, '')
  }
  return labels
}

/**
 * Галерея одним RPC: сотрудники, действующие образы и лайки месяца.
 * Без кэша: `liked_by_me` и счётчики должны быть свежими после голосования,
 * а остальные три запроса слишком мелкие, чтобы их кэшировать.
 */
export async function getGalleryPage(viewerId: string | null, winnersLimit = 12): Promise<GalleryPage> {
  const month = await getBimoMonth()
  const db = createSupabaseAdminClient()

  const [gallery, likeLimit, winners, lookLabels] = await Promise.all([
    db.rpc('fn_bimo_gallery', { p_month: month, p_voter_id: viewerId }),
    getLikeLimit(),
    loadWinners(winnersLimit),
    loadLookLabels(),
  ])

  if (gallery.error) throw new Error(gallery.error.message)

  const entries = ((gallery.data ?? []) as GalleryRow[]).map(toEntry)

  return {
    month,
    likeLimit,
    usedLikes: entries.filter((entry) => entry.likedByMe).length,
    entries,
    winners,
    lookLabels,
  }
}
