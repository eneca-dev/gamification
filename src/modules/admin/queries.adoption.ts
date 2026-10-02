import { createSupabaseAdminClient } from '@/config/supabase'
import { cached, CACHE_5M } from '@/lib/server-cache'
import type {
  AdoptionCoverageData, AdoptionOverviewData, AdoptionLoginDepartment,
  AdoptionLoginTeam, AdoptionLoginUser, AdoptionWorksectionData,
  AdoptionPluginsData, AdoptionSideEffectsData, AdoptionMonthlyFilters,
  AdoptionMonthlyReport, AdoptionMonthlySummary, AdoptionMonthlyRanking,
  AdoptionDateRange,
} from './adoption-types'

type RpcError = { message: string } | null

interface CoreCoverageRaw {
  company_total: number
  total_employees: number
  profiles_count: number
  earned_total: number
  earned_logged: number
  earners: number
  spent_total: number
  balance_at_to: number
}

interface LoginUserRaw {
  department: string
  team: string | null
  user_name: string
  logged_in: boolean
}

interface CoreRaw {
  coverage: CoreCoverageRaw
  overview: Omit<AdoptionOverviewData, 'login_by_department'> & { login_users: LoginUserRaw[] }
}

interface EngagementRaw {
  gratitude_total: number
  gratitude_senders: number
  gratitude_recipients: number
  shop_orders_total: number
  shop_orders_unique_users: number
  second_life_total: number
  second_life_users: number
  chatbot_messages_total: number
  chatbot_unique_users: number
  ws_streak_holders: number
  ws_streak_7plus: number
  revit_streak_holders: number
  revit_streak_7plus: number
}

export interface AdoptionPeriodDashboardData {
  coverage: AdoptionCoverageData
  overview: AdoptionOverviewData
  worksection: AdoptionWorksectionData
  plugins: AdoptionPluginsData
  sideEffects: AdoptionSideEffectsData
}

function rpcData<T>(value: unknown, name: string): T {
  if (!value || typeof value !== 'object') throw new Error(`${name}: база вернула пустой результат`)
  return value as T
}

function groupLoginUsers(rows: LoginUserRaw[]): AdoptionLoginDepartment[] {
  const pct = (logged: number, total: number) => total > 0 ? Math.round((logged / total) * 100) : 0
  const usersByTeam = new Map<string, AdoptionLoginUser[]>()
  for (const row of rows) {
    const key = `${row.department}|${row.team ?? ''}`
    const users = usersByTeam.get(key) ?? []
    users.push({ name: row.user_name, logged_in: row.logged_in })
    usersByTeam.set(key, users)
  }

  const departments = new Map<string, { total: number; logged_in: number; teams: AdoptionLoginTeam[] }>()
  for (const [key, users] of usersByTeam) {
    const separator = key.indexOf('|')
    const department = key.slice(0, separator)
    const team = key.slice(separator + 1) || null
    const logged = users.filter((user) => user.logged_in).length
    const aggregate = departments.get(department) ?? { total: 0, logged_in: 0, teams: [] }
    aggregate.total += users.length
    aggregate.logged_in += logged
    aggregate.teams.push({ team, total: users.length, logged_in: logged, pct: pct(logged, users.length), users })
    departments.set(department, aggregate)
  }

  return [...departments.entries()]
    .map(([department, data]) => ({
      department,
      total: data.total,
      logged_in: data.logged_in,
      pct: pct(data.logged_in, data.total),
      teams: data.teams.sort((a, b) => a.pct - b.pct || (a.team ?? '').localeCompare(b.team ?? '', 'ru')),
    }))
    .sort((a, b) => a.pct - b.pct || a.department.localeCompare(b.department, 'ru'))
}

/** Loads all period-dependent sections in four database round-trips. */
async function loadAdoptionPeriodDashboard(range: AdoptionDateRange): Promise<AdoptionPeriodDashboardData> {
  const supabase = createSupabaseAdminClient()
  const params = { p_from: range.from, p_to: range.to }
  const [coreRes, worksectionRes] = await Promise.all([
    supabase.rpc('get_adoption_period_core_v2', params),
    supabase.rpc('get_adoption_period_worksection_v3', params),
  ])
  const [pluginsRes, engagementRes] = await Promise.all([
    supabase.rpc('get_adoption_period_plugins_v2', params),
    supabase.rpc('get_adoption_period_engagement_v2', params),
  ])
  const responses = [coreRes, worksectionRes, pluginsRes, engagementRes] as Array<{ data: unknown; error: RpcError }>
  const [core, worksection, plugins, engagement] = responses
  const failures = [
    ['Основные показатели', core.error], ['Worksection', worksection.error],
    ['Revit-плагины', plugins.error], ['Вовлечённость', engagement.error],
  ].filter((item): item is [string, { message: string }] => Boolean(item[1]))
  if (failures.length) throw new Error(failures.map(([section, error]) => `${section}: ${error.message}`).join('; '))

  const coreData = rpcData<CoreRaw>(core.data, 'Основные показатели')
  const worksectionData = rpcData<AdoptionWorksectionData>(worksection.data, 'Worksection')
  const pluginsData = rpcData<AdoptionPluginsData>(plugins.data, 'Revit-плагины')
  const engagementData = rpcData<EngagementRaw>(engagement.data, 'Вовлечённость')
  const cohort = Number(coreData.coverage.total_employees ?? 0)
  const earned = Number(coreData.coverage.earned_total ?? 0)
  const earnedLogged = Number(coreData.coverage.earned_logged ?? 0)
  const earners = Number(coreData.coverage.earners ?? 0)
  const balance = Number(coreData.coverage.balance_at_to ?? 0)
  const percent = (value: number) => cohort > 0 ? Math.round((value / cohort) * 100) : 0

  return {
    coverage: {
      company_total: Number(coreData.coverage.company_total ?? 0), total_employees: cohort,
      profiles_count: Number(coreData.coverage.profiles_count ?? 0),
      profiles_pct: percent(Number(coreData.coverage.profiles_count ?? 0)), earned_total: earned,
      earned_logged_pct: earned > 0 ? Math.round((earnedLogged / earned) * 100) : 0,
    },
    overview: {
      total_cohort: Number(coreData.overview.total_cohort ?? 0),
      users_daily: coreData.overview.users_daily ?? [], revit_daily: coreData.overview.revit_daily ?? [],
      login_by_department: groupLoginUsers(coreData.overview.login_users ?? []),
    },
    worksection: worksectionData,
    plugins: pluginsData,
    sideEffects: {
      earners_count: earners, earners_pct: percent(earners),
      spent_total: Number(coreData.coverage.spent_total ?? 0), balance_total: balance,
      balance_avg: earners > 0 ? Math.round(balance / earners) : 0,
      gratitude_total: Number(engagementData.gratitude_total ?? 0),
      gratitude_senders: Number(engagementData.gratitude_senders ?? 0),
      gratitude_senders_pct: percent(Number(engagementData.gratitude_senders ?? 0)),
      gratitude_recipients: Number(engagementData.gratitude_recipients ?? 0),
      shop_orders_total: Number(engagementData.shop_orders_total ?? 0),
      shop_orders_unique_users: Number(engagementData.shop_orders_unique_users ?? 0),
      shop_orders_unique_users_pct: percent(Number(engagementData.shop_orders_unique_users ?? 0)),
      second_life_total: Number(engagementData.second_life_total ?? 0),
      second_life_users: Number(engagementData.second_life_users ?? 0),
      second_life_users_pct: percent(Number(engagementData.second_life_users ?? 0)),
      chatbot_messages_total: Number(engagementData.chatbot_messages_total ?? 0),
      chatbot_unique_users: Number(engagementData.chatbot_unique_users ?? 0),
      ws_streak_holders: Number(engagementData.ws_streak_holders ?? 0),
      ws_streak_7plus: Number(engagementData.ws_streak_7plus ?? 0),
      revit_streak_holders: Number(engagementData.revit_streak_holders ?? 0),
      revit_streak_7plus: Number(engagementData.revit_streak_7plus ?? 0),
    },
  }
}

export const getAdoptionPeriodDashboard = (range: AdoptionDateRange) =>
  cached(() => loadAdoptionPeriodDashboard(range), ['adoption-period', range.from ?? 'all', range.to], {
    revalidate: CACHE_5M,
  })()

/** Monthly report is deliberately independent from the top date filter. */
async function loadAdoptionMonthlyReport(filters: AdoptionMonthlyFilters): Promise<AdoptionMonthlyReport> {
  const supabase = createSupabaseAdminClient()
  const params = {
    p_from: filters.from, p_to: filters.to, p_scope: filters.scope,
    p_departments: filters.departments.length ? filters.departments : null,
  }
  const [summaryRes, rankingsRes] = await Promise.all([
    supabase.rpc('get_adoption_monthly_summary_v3', params),
    supabase.rpc('get_adoption_monthly_rankings_v2', params),
  ])
  if (summaryRes.error) throw new Error(`Итоги месяца: ${summaryRes.error.message}`)
  if (rankingsRes.error) throw new Error(`Топы месяца: ${rankingsRes.error.message}`)
  const summary = summaryRes.data as AdoptionMonthlySummary | null
  if (!summary) throw new Error('Итоги месяца: база вернула пустой результат')
  return { summary, rankings: (rankingsRes.data ?? []) as AdoptionMonthlyRanking[] }
}

export const getAdoptionMonthlyReport = (filters: AdoptionMonthlyFilters) =>
  cached(() => loadAdoptionMonthlyReport(filters), [
    'adoption-monthly', filters.from, filters.to, filters.scope, [...filters.departments].sort().join(','),
  ], { revalidate: CACHE_5M })()
