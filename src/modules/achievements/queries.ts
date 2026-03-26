import { createSupabaseAdminClient } from '@/config/supabase'

import type { AchievementProgress, RankingEntry } from './types'

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

// --- Revit ---
export const getRevitPersonalRanking = (limit = 10) => fetchPersonalRanking('view_top_pers_revit', limit)
export const getRevitTeamRanking = (limit = 5) => fetchTeamRanking('view_top_team_revit', limit)
export const getRevitDepartmentRanking = (limit = 5) => fetchDepartmentRanking('view_top_dept_revit', limit)

// --- Worksection ---
export const getWsPersonalRanking = (limit = 10) => fetchPersonalRanking('view_top_pers_ws', limit)
export const getWsTeamRanking = (limit = 5) => fetchTeamRanking('view_top_team_ws', limit)
export const getWsDepartmentRanking = (limit = 5) => fetchDepartmentRanking('view_top_dept_ws', limit)
