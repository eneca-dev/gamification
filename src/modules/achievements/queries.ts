import { createSupabaseAdminClient } from '@/config/supabase'

import type { AchievementProgress, RankingEntry, GratitudeAchProgress, CompanyAward, CompanyProgressEntry } from './types'

export async function getAchievementProgress(
  wsUserId: string
): Promise<AchievementProgress | null> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc('fn_ach_get_progress', { p_user_id: wsUserId })
  if (error) {
    console.error('getAchievementProgress:', error.message)
    return null
  }
  return data as AchievementProgress
}

// --- Хелперы для personal / team / department рейтингов ---

async function fetchPersonalRanking(viewName: string, limit: number): Promise<RankingEntry[]> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from(viewName)
    .select('rank, user_id, first_name, last_name, department_code, total_coins')
    .lte('rank', limit)
    .order('rank')

  if (error) { console.error(`${viewName}:`, error.message); return [] }

  return (data ?? []).map((r) => ({
    rank: r.rank,
    entity_id: r.user_id,
    label: `${r.first_name} ${r.last_name}`,
    score: Number(r.total_coins),
    extra: r.department_code,
  }))
}

async function fetchTeamRanking(viewName: string, limit: number): Promise<RankingEntry[]> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from(viewName)
    .select('rank, team, users_earning, total_employees, contest_score')
    .lte('rank', limit)
    .order('rank')

  if (error) { console.error(`${viewName}:`, error.message); return [] }

  return (data ?? []).map((r) => ({
    rank: r.rank,
    entity_id: r.team,
    label: r.team,
    score: Number(r.contest_score),
    extra: `${r.users_earning}/${r.total_employees}`,
  }))
}

async function fetchDepartmentRanking(viewName: string, limit: number): Promise<RankingEntry[]> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from(viewName)
    .select('rank, department_code, users_earning, total_employees, contest_score')
    .lte('rank', limit)
    .order('rank')

  if (error) { console.error(`${viewName}:`, error.message); return [] }

  return (data ?? []).map((r) => ({
    rank: r.rank,
    entity_id: r.department_code,
    label: r.department_code,
    score: Number(r.contest_score),
    extra: `${r.users_earning}/${r.total_employees}`,
  }))
}

// --- Прогресс достижений по благодарностям ---
export async function getGratitudeAchievementProgress(
  wsUserId: string
): Promise<GratitudeAchProgress[]> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc('fn_ach_get_gratitude_progress', { p_user_id: wsUserId })
  if (error) {
    console.error('getGratitudeAchievementProgress:', error.message)
    return []
  }
  return (data ?? []) as GratitudeAchProgress[]
}

// --- Достижения компании (все пользователи) ---
export async function getCompanyAwards(
  periodStart?: string,
  periodEnd?: string
): Promise<CompanyAward[]> {
  const supabase = createSupabaseAdminClient()

  let query = supabase
    .from('ach_awards')
    .select('id, entity_id, entity_type, area, period_start, days_in_top, awarded_at, score')
    .order('awarded_at', { ascending: false })

  if (periodStart) query = query.gte('period_start', periodStart)
  if (periodEnd) query = query.lte('period_start', periodEnd)

  const { data, error } = await query
  if (error) {
    console.error('getCompanyAwards:', error.message)
    return []
  }

  if (!data || data.length === 0) return []

  // Получаем имена для user-достижений
  const userIds = data
    .filter((a) => a.entity_type === 'user')
    .map((a) => a.entity_id)

  let usersMap = new Map<string, string>()
  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from('ws_users')
      .select('id, first_name, last_name')
      .in('id', userIds)

    if (users) {
      usersMap = new Map(
        users.map((u) => [String(u.id), `${u.first_name} ${u.last_name}`])
      )
    }
  }

  return data.map((a) => ({
    id: a.id,
    entity_id: a.entity_id,
    entity_type: a.entity_type,
    area: a.area,
    period_start: a.period_start,
    days_in_top: a.days_in_top,
    awarded_at: a.awarded_at,
    score: Number(a.score),
    label:
      a.entity_type === 'user'
        ? usersMap.get(a.entity_id) ?? a.entity_id
        : a.entity_id,
  })) as CompanyAward[]
}

// --- Прогресс всей компании (для админки) ---

export async function getRankingProgressAll(): Promise<CompanyProgressEntry[]> {
  const supabase = createSupabaseAdminClient()

  // Текущий период
  const { data: periodData } = await supabase.rpc('fn_ach_period_start', { p_date: new Date().toISOString().slice(0, 10) })
  const periodStart = periodData as string | null
  if (!periodStart) return []

  // Снапшоты за текущий период — считаем дни в топе
  const { data: snapshots, error: snapErr } = await supabase
    .from('ach_ranking_snapshots')
    .select('entity_id, entity_type, area, snapshot_date')
    .eq('period_start', periodStart)

  if (snapErr || !snapshots) {
    console.error('getRankingProgressAll:', snapErr?.message)
    return []
  }

  // Пороги
  const { data: settings } = await supabase
    .from('ach_ranking_settings')
    .select('area, entity_type, threshold')
    .eq('is_active', true)

  const thresholdMap = new Map<string, number>()
  for (const s of settings ?? []) {
    thresholdMap.set(`${s.area}:${s.entity_type}`, s.threshold)
  }

  // Агрегация: entity_id + entity_type + area → count(distinct snapshot_date)
  const countsMap = new Map<string, { entity_id: string; entity_type: string; area: string; days: number }>()
  for (const s of snapshots) {
    const key = `${s.entity_id}:${s.entity_type}:${s.area}`
    const existing = countsMap.get(key)
    if (existing) {
      existing.days += 1
    } else {
      countsMap.set(key, { entity_id: s.entity_id, entity_type: s.entity_type, area: s.area, days: 1 })
    }
  }

  // Имена пользователей
  const userIds = [...new Set(
    [...countsMap.values()].filter((c) => c.entity_type === 'user').map((c) => c.entity_id)
  )]
  let usersMap = new Map<string, string>()
  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from('ws_users')
      .select('id, first_name, last_name')
      .in('id', userIds)
    if (users) {
      usersMap = new Map(users.map((u) => [String(u.id), `${u.first_name} ${u.last_name}`]))
    }
  }

  const result: CompanyProgressEntry[] = []
  for (const c of countsMap.values()) {
    const threshold = thresholdMap.get(`${c.area}:${c.entity_type}`) ?? 10
    const remaining = Math.max(0, threshold - c.days)
    result.push({
      entity_id: c.entity_id,
      entity_type: c.entity_type as CompanyProgressEntry['entity_type'],
      area: c.area,
      label: c.entity_type === 'user'
        ? usersMap.get(c.entity_id) ?? c.entity_id
        : c.entity_id,
      days_in_top: c.days,
      threshold,
      remaining,
      earned: c.days >= threshold,
    })
  }

  return result.sort((a, b) => a.remaining - b.remaining)
}

export async function getGratitudeProgressAll(): Promise<CompanyProgressEntry[]> {
  const supabase = createSupabaseAdminClient()

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  // Подарки за текущий месяц по получателям и категориям
  const { data: gifts, error: gErr } = await supabase
    .from('gratitudes')
    .select('recipient_id, category')
    .eq('type', 'gift')
    .gte('created_at', monthStart.toISOString())

  if (gErr || !gifts) {
    console.error('getGratitudeProgressAll:', gErr?.message)
    return []
  }

  // Пороги
  const { data: settings } = await supabase
    .from('ach_gratitude_settings')
    .select('category, achievement_name, threshold, bonus_coins')
    .eq('is_active', true)

  if (!settings || settings.length === 0) return []

  const settingsMap = new Map(settings.map((s) => [s.category, s]))

  // Агрегация
  const countsMap = new Map<string, number>()
  for (const g of gifts) {
    if (!g.category || !settingsMap.has(g.category)) continue
    const key = `${g.recipient_id}:${g.category}`
    countsMap.set(key, (countsMap.get(key) ?? 0) + 1)
  }

  // Имена
  const userIds = [...new Set(gifts.map((g) => g.recipient_id))]
  let usersMap = new Map<string, string>()
  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from('ws_users')
      .select('id, first_name, last_name')
      .in('id', userIds)
    if (users) {
      usersMap = new Map(users.map((u) => [String(u.id), `${u.first_name} ${u.last_name}`]))
    }
  }

  const result: CompanyProgressEntry[] = []
  for (const [key, count] of countsMap) {
    const [recipientId, category] = key.split(':')
    const s = settingsMap.get(category)
    if (!s) continue
    const threshold = s.threshold
    const remaining = Math.max(0, threshold - count)
    result.push({
      entity_id: recipientId,
      entity_type: 'user',
      area: `gratitude_${category}`,
      label: usersMap.get(recipientId) ?? recipientId,
      days_in_top: count,
      threshold,
      remaining,
      earned: count >= threshold,
    })
  }

  return result.sort((a, b) => a.remaining - b.remaining)
}

// --- Revit ---
export const getRevitPersonalRanking = (limit = 10) => fetchPersonalRanking('view_top_pers_revit', limit)
export const getRevitTeamRanking = (limit = 5) => fetchTeamRanking('view_top_team_revit', limit)
export const getRevitDepartmentRanking = (limit = 5) => fetchDepartmentRanking('view_top_dept_revit', limit)

// --- Worksection ---
export const getWsPersonalRanking = (limit = 10) => fetchPersonalRanking('view_top_pers_ws', limit)
export const getWsTeamRanking = (limit = 5) => fetchTeamRanking('view_top_team_ws', limit)
export const getWsDepartmentRanking = (limit = 5) => fetchDepartmentRanking('view_top_dept_ws', limit)
