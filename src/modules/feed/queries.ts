import { createSupabaseAdminClient } from '@/config/supabase'
import { cached, CACHE_5M } from '@/lib/server-cache'
import type { CompanyAward } from '@/modules/achievements/types'
import type { GratitudeNew } from '@/modules/gratitudes/types'

import type {
  AchBreakdown,
  AchievementBadge,
  DepartmentFeedData,
  GratitudeBadge,
  PersonFeedRow,
  TeamFeedData,
  TeamFeedRow,
} from './types'

// ── Хелпер: прогресс-бейджи достижений ───────────────────────────────────────

function buildAchievementBadges(
  entityId: string,
  entityType: 'user' | 'team' | 'department',
  snapCountMap: Map<string, number>,
  thresholdMap: Map<string, number>,
  earnedSet: Set<string>,
  gratCounts?: Map<string, number>, // кол-во полученных благодарностей по категории
): AchievementBadge[] {
  const rankingAreas = ['revit', 'ws', 'gratitude'] as const
  const badges: AchievementBadge[] = rankingAreas
    .map((area) => ({
      area,
      daysInTop: snapCountMap.get(`${entityId}:${entityType}:${area}`) ?? 0,
      threshold: thresholdMap.get(`${area}:${entityType}`) ?? 0,
      earned: earnedSet.has(`${entityId}:${entityType}:${area}`),
    }))
    .filter((b) => b.daysInTop > 0 || b.earned)

  // Достижения за благодарности — всегда добавляем все 3, с реальным счётчиком
  if (entityType === 'user') {
    const gratAreas = ['gratitude_help', 'gratitude_quality', 'gratitude_mentoring'] as const
    for (const area of gratAreas) {
      const isEarned = earnedSet.has(`${entityId}:user:${area}`)
      const category = area.replace('gratitude_', '')
      const count = gratCounts?.get(category) ?? 0
      const threshold = thresholdMap.get(`${area}:user`) ?? 0
      badges.push({ area, daysInTop: count, threshold, earned: isEarned })
    }
  }

  return badges
}

// ── Хелпер: общие карты из результатов запросов ───────────────────────────────

interface FeedMaps {
  revitMap: Map<string, number>
  wsMap: Map<string, number>
  usersNameMap: Map<string, string>
  earnedSet: Set<string>
  awards: CompanyAward[]
  snapCountMap: Map<string, number>
  thresholdMap: Map<string, number>
}

function buildFeedMaps(
  userList: Array<{ id: unknown; first_name: string | null; last_name: string | null }>,
  revitRows: Array<{ user_id: unknown; total_coins: number }> | null,
  wsRows: Array<{ user_id: unknown; total_coins: number }> | null,
  awardsRows: Array<{ id: string; entity_id: string; entity_type: string; area: string; period_start: string; days_in_top: number; awarded_at: string; score: number }> | null,
  snapshotRows: Array<{ entity_id: string; entity_type: string; area: string; snapshot_date: string }> | null,
  settingsRows: Array<{ area: string; entity_type: string; threshold: number }> | null,
): FeedMaps {
  const revitMap = new Map((revitRows ?? []).map((r) => [String(r.user_id), Number(r.total_coins)]))
  const wsMap = new Map((wsRows ?? []).map((r) => [String(r.user_id), Number(r.total_coins)]))
  const usersNameMap = new Map(
    userList.map((u) => [String(u.id), `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim()]),
  )

  const earnedSet = new Set<string>()
  const awards: CompanyAward[] = (awardsRows ?? []).map((a) => {
    earnedSet.add(`${a.entity_id}:${a.entity_type}:${a.area}`)
    return {
      id: a.id,
      entity_id: a.entity_id,
      entity_type: a.entity_type as CompanyAward['entity_type'],
      area: a.area,
      period_start: a.period_start,
      days_in_top: a.days_in_top,
      awarded_at: a.awarded_at,
      score: Number(a.score),
      label: a.entity_type === 'user' ? (usersNameMap.get(a.entity_id) ?? a.entity_id) : a.entity_id,
    }
  })

  const snapCountMap = new Map<string, number>()
  const seenSnap = new Set<string>()
  for (const s of snapshotRows ?? []) {
    const key = `${s.entity_id}:${s.entity_type}:${s.area}`
    const dateKey = `${key}:${s.snapshot_date}`
    if (!seenSnap.has(dateKey)) {
      seenSnap.add(dateKey)
      snapCountMap.set(key, (snapCountMap.get(key) ?? 0) + 1)
    }
  }

  const thresholdMap = new Map<string, number>()
  for (const s of settingsRows ?? []) {
    thresholdMap.set(`${s.area}:${s.entity_type}`, s.threshold)
  }

  return { revitMap, wsMap, usersNameMap, earnedSet, awards, snapCountMap, thresholdMap }
}

// ── Хелперы для дат и прямого запроса транзакций ────────────────────────────

function getMinskyDates() {
  const ms = Date.now() + 3 * 60 * 60 * 1000 // UTC+3, Минск без DST
  const today = new Date(ms)
  const yesterday = new Date(ms - 86_400_000)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return {
    wsStart: `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-01`,
    wsEnd: fmt(today),
    revitStart: `${yesterday.getUTCFullYear()}-${String(yesterday.getUTCMonth() + 1).padStart(2, '0')}-01`,
    revitEnd: fmt(yesterday),
  }
}

async function fetchMonthlyCoins(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userIds: string[],
  source: 'revit' | 'ws',
  start: string,
  end: string,
): Promise<Array<{ user_id: string; total_coins: number }>> {
  if (userIds.length === 0) return []
  const { data } = await supabase
    .from('gamification_transactions')
    .select('user_id, coins, gamification_event_logs!inner(source, event_date)')
    .in('user_id', userIds)
    .eq('gamification_event_logs.source', source)
    .gte('gamification_event_logs.event_date', start)
    .lte('gamification_event_logs.event_date', end)
  const totals = new Map<string, number>()
  for (const row of data ?? []) {
    const uid = String(row.user_id)
    totals.set(uid, (totals.get(uid) ?? 0) + Number(row.coins))
  }
  return [...totals.entries()].map(([user_id, total_coins]) => ({ user_id, total_coins }))
}

// ── getDepartmentFeedData ─────────────────────────────────────────────────────

async function _getDepartmentFeedData(
  departmentCode: string,
  monthStart: string,
  monthEnd: string,
): Promise<DepartmentFeedData> {
  const supabase = createSupabaseAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  // Шаг 1 — список сотрудников + текущий период достижений
  const [usersResult, periodResult] = await Promise.all([
    supabase
      .from('ws_users')
      .select('id, first_name, last_name, team')
      .eq('department_code', departmentCode)
      .eq('is_active', true)
      .order('last_name'),
    supabase.rpc('fn_ach_period_start', { p_date: today }),
  ])

  const userList = usersResult.data ?? []
  const periodStart = (periodResult.data as string | null) ?? null
  const userIds = userList.map((u) => String(u.id))
  const teams = [...new Set(userList.map((u) => u.team).filter((t): t is string => Boolean(t)))]
  const allEntityIds = [...userIds, ...teams, departmentCode]

  // Шаг 2 — все данные параллельно
  const minskyDates = getMinskyDates()
  const [revitCoinsData, wsCoinsData, awardsRes, gratitudesRes, snapshotsRes, settingsRes] =
    await Promise.all([
      fetchMonthlyCoins(supabase, userIds, 'revit', minskyDates.revitStart, minskyDates.revitEnd),
      fetchMonthlyCoins(supabase, userIds, 'ws', minskyDates.wsStart, minskyDates.wsEnd),
      supabase
        .from('ach_awards')
        .select('id, entity_id, entity_type, area, period_start, days_in_top, awarded_at, score')
        .in('entity_id', allEntityIds)
        .gte('period_start', periodStart ?? `${new Date().getFullYear()}-01-01`)
        .order('awarded_at', { ascending: false }),
      supabase
        .from('v_gratitudes_feed_new')
        .select('*')
        .eq('recipient_department', departmentCode)
        .gte('created_at', monthStart)
        .lte('created_at', monthEnd)
        .order('created_at', { ascending: false }),
      periodStart
        ? supabase
            .from('ach_ranking_snapshots')
            .select('entity_id, entity_type, area, snapshot_date')
            .eq('period_start', periodStart)
            .in('entity_id', allEntityIds)
        : Promise.resolve({ data: [] as { entity_id: string; entity_type: string; area: string; snapshot_date: string }[], error: null }),
      supabase.from('ach_ranking_settings').select('area, entity_type, threshold').eq('is_active', true),
    ])

  const { revitMap, wsMap, earnedSet, awards, snapCountMap, thresholdMap } =
    buildFeedMaps(userList, revitCoinsData, wsCoinsData, awardsRes.data, snapshotsRes.data, settingsRes.data)

  const feedGratitudes = (gratitudesRes.data ?? []) as GratitudeNew[]

  // Карта благодарностей по имени получателя
  const gratsByName = new Map<string, GratitudeBadge[]>()
  for (const g of feedGratitudes) {
    const list = gratsByName.get(g.recipient_name) ?? []
    list.push({ category: g.category })
    gratsByName.set(g.recipient_name, list)
  }

  // Группировка сотрудников по команде
  const teamMembersMap = new Map<string, PersonFeedRow[]>()
  for (const user of userList) {
    const teamName = user.team || 'Вне команд'
    const fullName = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim()
    const uid = String(user.id)
    const userGrats = gratsByName.get(fullName) ?? []
    const gratCounts = new Map<string, number>()
    for (const g of userGrats) {
      if (g.category) gratCounts.set(g.category, (gratCounts.get(g.category) ?? 0) + 1)
    }
    const person: PersonFeedRow = {
      userId: uid,
      name: fullName,
      revitCoins: revitMap.get(uid) ?? 0,
      wsCoins: wsMap.get(uid) ?? 0,
      achievements: buildAchievementBadges(uid, 'user', snapCountMap, thresholdMap, earnedSet, gratCounts),
      gratitudes: userGrats,
    }
    if (!teamMembersMap.has(teamName)) teamMembersMap.set(teamName, [])
    teamMembersMap.get(teamName)!.push(person)
  }

  // Сборка строк команд
  const awardCountByUser = new Map<string, number>()
  const awardCountByTeam = new Map<string, number>()
  for (const a of awards) {
    if (a.entity_type === 'user') awardCountByUser.set(a.entity_id, (awardCountByUser.get(a.entity_id) ?? 0) + 1)
    else if (a.entity_type === 'team') awardCountByTeam.set(a.entity_id, (awardCountByTeam.get(a.entity_id) ?? 0) + 1)
  }

  const teamRows: TeamFeedRow[] = []
  for (const [teamName, members] of teamMembersMap) {
    const sorted = members.sort((a, b) => (b.revitCoins + b.wsCoins) - (a.revitCoins + a.wsCoins))
    const memberIdSet = new Set(sorted.map((m) => m.userId))
    const teamUserEarned = [...memberIdSet].reduce((s, uid) => s + (awardCountByUser.get(uid) ?? 0), 0)
    const teamTeamEarned = awardCountByTeam.get(teamName) ?? 0
    teamRows.push({
      team: teamName,
      revitCoins: sorted.reduce((s, m) => s + m.revitCoins, 0),
      wsCoins: sorted.reduce((s, m) => s + m.wsCoins, 0),
      earnedAchievementsCount: teamUserEarned + teamTeamEarned,
      achBreakdown: { user: teamUserEarned, team: teamTeamEarned },
      gratitudesCount: sorted.reduce((s, m) => s + m.gratitudes.length, 0),
      achievements: buildAchievementBadges(teamName, 'team', snapCountMap, thresholdMap, earnedSet),
      members: sorted,
    })
  }

  teamRows.sort((a, b) => (b.revitCoins + b.wsCoins) - (a.revitCoins + a.wsCoins))

  const deptBreakdown: AchBreakdown = {
    user: awards.filter((a) => a.entity_type === 'user').length,
    team: awards.filter((a) => a.entity_type === 'team').length,
    department: awards.filter((a) => a.entity_type === 'department').length,
  }

  return {
    department: departmentCode,
    revitCoins: teamRows.reduce((s, t) => s + t.revitCoins, 0),
    wsCoins: teamRows.reduce((s, t) => s + t.wsCoins, 0),
    earnedAchievementsCount: awards.length,
    achBreakdown: deptBreakdown,
    gratitudesCount: teamRows.reduce((s, t) => s + t.gratitudesCount, 0),
    achievements: buildAchievementBadges(departmentCode, 'department', snapCountMap, thresholdMap, earnedSet),
    teams: teamRows,
    awards,
    feedGratitudes,
  }
}

// ── getTeamFeedData ───────────────────────────────────────────────────────────

async function _getTeamFeedData(
  team: string | null,
  departmentCode: string,
  monthStart: string,
  monthEnd: string,
): Promise<TeamFeedData> {
  const supabase = createSupabaseAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  // Для null-команды нужен отдел — без него запрос вернёт всю компанию
  if (team === null && !departmentCode) {
    return {
      team: 'Вне команд', department: '', revitCoins: 0, wsCoins: 0,
      earnedAchievementsCount: 0, achBreakdown: { user: 0, team: 0 },
      gratitudesCount: 0, achievements: [], members: [], awards: [], feedGratitudes: [],
    }
  }

  const usersQuery = supabase
    .from('ws_users')
    .select('id, first_name, last_name')
    .eq('is_active', true)
    .order('last_name')

  const [usersResult, periodResult] = await Promise.all([
    team === null
      ? usersQuery.eq('department_code', departmentCode)            // все сотрудники отдела
      : usersQuery.eq('team', team).eq('department_code', departmentCode),
    supabase.rpc('fn_ach_period_start', { p_date: today }),
  ])

  const userList = usersResult.data ?? []
  const periodStart = (periodResult.data as string | null) ?? null
  const userIds = userList.map((u) => String(u.id))
  // Supabase отклоняет пустой массив в .in() — подставляем несуществующий UUID
  const nonExistentId = '00000000-0000-0000-0000-000000000000'
  // Для null-команды нет командной сущности в ach_awards
  const allEntityIds = team !== null
    ? (userIds.length > 0 ? [...userIds, team] : [team])
    : (userIds.length > 0 ? userIds : [nonExistentId])

  const minskyDates = getMinskyDates()
  const [revitCoinsData, wsCoinsData, awardsRes, gratitudesRes, snapshotsRes, settingsRes] =
    await Promise.all([
      fetchMonthlyCoins(supabase, userIds, 'revit', minskyDates.revitStart, minskyDates.revitEnd),
      fetchMonthlyCoins(supabase, userIds, 'ws', minskyDates.wsStart, minskyDates.wsEnd),
      supabase
        .from('ach_awards')
        .select('id, entity_id, entity_type, area, period_start, days_in_top, awarded_at, score')
        .in('entity_id', allEntityIds)
        .gte('period_start', periodStart ?? `${new Date().getFullYear()}-01-01`)
        .order('awarded_at', { ascending: false }),
      supabase
        .from('v_gratitudes_feed_new')
        .select('*')
        .eq('recipient_department', departmentCode)
        .gte('created_at', monthStart)
        .lte('created_at', monthEnd)
        .order('created_at', { ascending: false }),
      periodStart
        ? supabase
            .from('ach_ranking_snapshots')
            .select('entity_id, entity_type, area, snapshot_date')
            .eq('period_start', periodStart)
            .in('entity_id', allEntityIds)
        : Promise.resolve({ data: [] as { entity_id: string; entity_type: string; area: string; snapshot_date: string }[], error: null }),
      supabase.from('ach_ranking_settings').select('area, entity_type, threshold').eq('is_active', true),
    ])

  const { revitMap, wsMap, earnedSet, awards, snapCountMap, thresholdMap } =
    buildFeedMaps(userList, revitCoinsData, wsCoinsData, awardsRes.data, snapshotsRes.data, settingsRes.data)

  // Фильтрация благодарностей только для членов команды
  const teamUserNames = new Set(
    userList.map((u) => `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim()),
  )
  const feedGratitudes = ((gratitudesRes.data ?? []) as GratitudeNew[]).filter(
    (g) => teamUserNames.has(g.recipient_name),
  )

  const gratsByName = new Map<string, GratitudeBadge[]>()
  for (const g of feedGratitudes) {
    const list = gratsByName.get(g.recipient_name) ?? []
    list.push({ category: g.category })
    gratsByName.set(g.recipient_name, list)
  }

  const members: PersonFeedRow[] = userList
    .map((user) => {
      const fullName = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim()
      const uid = String(user.id)
      const userGrats = gratsByName.get(fullName) ?? []
      const gratCounts = new Map<string, number>()
      for (const g of userGrats) {
        if (g.category) gratCounts.set(g.category, (gratCounts.get(g.category) ?? 0) + 1)
      }
      return {
        userId: uid,
        name: fullName,
        revitCoins: revitMap.get(uid) ?? 0,
        wsCoins: wsMap.get(uid) ?? 0,
        achievements: buildAchievementBadges(uid, 'user', snapCountMap, thresholdMap, earnedSet, gratCounts),
        gratitudes: userGrats,
      }
    })
    .sort((a, b) => (b.revitCoins + b.wsCoins) - (a.revitCoins + a.wsCoins))

  const teamBreakdown: AchBreakdown = {
    user: awards.filter((a) => a.entity_type === 'user').length,
    team: awards.filter((a) => a.entity_type === 'team').length,
  }

  return {
    team: team ?? 'Вне команд',
    department: departmentCode,
    revitCoins: members.reduce((s, m) => s + m.revitCoins, 0),
    wsCoins: members.reduce((s, m) => s + m.wsCoins, 0),
    earnedAchievementsCount: awards.length,
    achBreakdown: teamBreakdown,
    gratitudesCount: feedGratitudes.length,
    achievements: team ? buildAchievementBadges(team, 'team', snapCountMap, thresholdMap, earnedSet) : [],
    members,
    awards,
    feedGratitudes,
  }
}

// ── Экспорты с кэшем ──────────────────────────────────────────────────────────

export const getDepartmentFeedData = (dept: string, monthStart: string, monthEnd: string) =>
  cached(
    () => _getDepartmentFeedData(dept, monthStart, monthEnd),
    ['dept-feed-v2', dept, monthStart, monthEnd],
    { tags: [`dept-feed-${dept}`], revalidate: CACHE_5M },
  )()

export const getTeamFeedData = (team: string | null, dept: string, monthStart: string, monthEnd: string) =>
  cached(
    () => _getTeamFeedData(team, dept, monthStart, monthEnd),
    ['team-feed-v3', team ?? 'no-team', dept, monthStart, monthEnd],
    { tags: [`team-feed-${team ?? `no-team-${dept}`}`], revalidate: CACHE_5M },
  )()
