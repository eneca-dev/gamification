import { createSupabaseAdminClient } from '@/config/supabase'
import type {
  AdoptionCoverageData,
  AdoptionOverviewData,
  AdoptionUsersDay,
  AdoptionLoginDepartment,
  AdoptionLoginTeam,
  AdoptionLoginUser,
  AdoptionWorksectionData,
  AdoptionWsDay,
  AdoptionRedUser,
  AdoptionLoginEffectGroup,
  AdoptionPluginsData,
  AdoptionSideEffectsData,
} from './adoption-types'

const LAUNCH_DATE = '2026-07-01'
// Период ДО = два рабочих дня до запуска (пн–вт)
const BEFORE_FROM = '2026-06-29'
const BEFORE_TO = '2026-06-30'
// Данные плагинов: начало исторической выгрузки и месячная база ДО для интенсивности
const ELK_BASELINE_FROM = '2026-05-04'
const JUNE_FROM = '2026-06-01'
const PAGE = 1000

type RpcError = { message: string } | null

// Данные синхронизируются по вчерашний день — сегодня в расчёт не включаем,
// иначе день без данных занижает все показатели after-периода
function getYesterday(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

// ВАЖНО: fetcher обязан задавать стабильный .order() — без него Postgres
// не гарантирует порядок строк между страницами и часть данных теряется
async function fetchAll<T>(
  fetcher: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: RpcError }>
): Promise<T[]> {
  const all: T[] = []
  let offset = 0
  while (true) {
    const { data, error } = await fetcher(offset, offset + PAGE - 1)
    if (error) throw new Error(error.message)
    const rows = data ?? []
    all.push(...rows)
    if (rows.length < PAGE) break
    offset += PAGE
  }
  return all
}

// --- Вспомогательные функции ---

function getWorkdayList(
  from: string,
  to: string,
  holidays: Set<string>,
  transfers: Set<string>,
): string[] {
  const days: string[] = []
  const cur = new Date(from + 'T00:00:00Z')
  const end = new Date(to + 'T00:00:00Z')
  while (cur <= end) {
    const dow = cur.getUTCDay()
    const ds = cur.toISOString().slice(0, 10)
    if ((dow >= 1 && dow <= 5 && !holidays.has(ds)) || transfers.has(ds)) days.push(ds)
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return days
}

// --- Запросы ---

type CoverageRow = { total_employees: number; profiles_count: number; balances_count: number }
type CoverageRes = { data: CoverageRow[] | null; error: RpcError }

export async function getAdoptionCoverage(): Promise<AdoptionCoverageData> {
  const supabase = createSupabaseAdminClient()

  type EarnedRow = { earned_total: string; earned_logged: string }

  const [coverageRes, earnedRes, companyRes] = await Promise.all([
    supabase.rpc('get_adoption_coverage') as unknown as Promise<CoverageRes>,
    supabase.rpc('get_adoption_earned', {
      p_from: LAUNCH_DATE,
    }) as unknown as Promise<{ data: EarnedRow[] | null; error: RpcError }>,
    supabase.from('ws_users').select('id', { count: 'exact', head: true }).eq('is_active', true),
  ])

  if (coverageRes.error) throw new Error(coverageRes.error.message)
  if (earnedRes.error) throw new Error(earnedRes.error.message)
  if (companyRes.error) throw new Error(companyRes.error.message)

  const row = coverageRes.data?.[0]
  const total = Number(row?.total_employees ?? 0)
  const profiles = Number(row?.profiles_count ?? 0)
  const earnedTotal = Number(earnedRes.data?.[0]?.earned_total ?? 0)
  const earnedLogged = Number(earnedRes.data?.[0]?.earned_logged ?? 0)

  return {
    company_total: companyRes.count ?? 0,
    total_employees: total,
    profiles_count: profiles,
    profiles_pct: total > 0 ? Math.round((profiles / total) * 100) : 0,
    earned_total: earnedTotal,
    earned_logged_pct: earnedTotal > 0 ? Math.round((earnedLogged / earnedTotal) * 100) : 0,
  }
}

// Верхние графики: входы + личные улучшения vs 29–30.06, Revit по рабочим дням
export async function getAdoptionOverview(): Promise<AdoptionOverviewData> {
  const supabase = createSupabaseAdminClient()
  const today = getYesterday()

  type UsersRow = { day: string; logged_in: string }
  type ImprovedRow = { day: string; logged_in: boolean; improved_ws: string; improved_revit: string }
  type RevitRow = { day: string; users: string }
  type LoginDeptRow = { department: string; team: string | null; total: string; logged_in: string }
  type LoginUserRow = { department: string; team: string | null; user_name: string; logged_in: boolean }

  const [coverageRes, usersRes, improvedRes, prelaunchRes, revitRes, holidaysRes, transfersRes, loginDeptRes, loginUsersRes] = await Promise.all([
    supabase.rpc('get_adoption_coverage') as unknown as Promise<CoverageRes>,
    supabase.rpc('get_adoption_users_daily', {
      p_from: BEFORE_FROM,
      p_to: today,
    }) as unknown as Promise<{ data: UsersRow[] | null; error: RpcError }>,
    supabase.rpc('get_adoption_improved_daily_split', {
      p_from: LAUNCH_DATE,
      p_to: today,
    }) as unknown as Promise<{ data: ImprovedRow[] | null; error: RpcError }>,
    // Естественный фон улучшений до запуска: 29–30.06 против 25–26.06 (дефолты функции)
    supabase.rpc('get_adoption_improved_prelaunch') as unknown as Promise<{ data: ImprovedRow[] | null; error: RpcError }>,
    supabase.rpc('get_adoption_revit_daily', {
      p_from: BEFORE_FROM,
      p_to: today,
    }) as unknown as Promise<{ data: RevitRow[] | null; error: RpcError }>,
    supabase.from('calendar_holidays').select('date'),
    supabase.from('calendar_workdays').select('date'),
    supabase.rpc('get_adoption_login_by_department') as unknown as Promise<{ data: LoginDeptRow[] | null; error: RpcError }>,
    supabase.rpc('get_adoption_login_users') as unknown as Promise<{ data: LoginUserRow[] | null; error: RpcError }>,
  ])

  if (coverageRes.error) throw new Error(coverageRes.error.message)
  if (usersRes.error) throw new Error(usersRes.error.message)
  if (improvedRes.error) throw new Error(improvedRes.error.message)
  if (prelaunchRes.error) throw new Error(prelaunchRes.error.message)
  if (revitRes.error) throw new Error(revitRes.error.message)
  if (loginDeptRes.error) throw new Error(loginDeptRes.error.message)
  if (loginUsersRes.error) throw new Error(loginUsersRes.error.message)

  // Улучшения приходят двумя строками на день (вошедшие/не вошедшие) — сводим в одну.
  // Точки до запуска (29–30.06) — фон улучшений относительно 25–26.06
  const improvedByDay = new Map<string, { lw: number; lr: number; nw: number; nr: number }>()
  for (const r of [...(prelaunchRes.data ?? []), ...(improvedRes.data ?? [])]) {
    const entry = improvedByDay.get(r.day) ?? { lw: 0, lr: 0, nw: 0, nr: 0 }
    if (r.logged_in) {
      entry.lw = Number(r.improved_ws)
      entry.lr = Number(r.improved_revit)
    } else {
      entry.nw = Number(r.improved_ws)
      entry.nr = Number(r.improved_revit)
    }
    improvedByDay.set(r.day, entry)
  }

  const usersDaily: AdoptionUsersDay[] = (usersRes.data ?? []).map((r) => {
    const imp = improvedByDay.get(r.day)
    return {
      day: r.day,
      logged_in: Number(r.logged_in),
      improved_ws: imp ? imp.lw + imp.nw : null,
      improved_revit: imp ? imp.lr + imp.nr : null,
      improved_ws_logged: imp ? imp.lw : null,
      improved_revit_logged: imp ? imp.lr : null,
      improved_ws_not_logged: imp ? imp.nw : null,
      improved_revit_not_logged: imp ? imp.nr : null,
    }
  })

  const holidays = new Set((holidaysRes.data ?? []).map((r) => r.date as string))
  const transfers = new Set((transfersRes.data ?? []).map((r) => r.date as string))
  const workdays = new Set(getWorkdayList(BEFORE_FROM, today, holidays, transfers))

  // Вход по отделам: группируем команды по отделу, считаем % по отделу и по команде,
  // сортируем по возрастанию % — худшие по входу наверху. Люди — не вошедшие первыми
  // (порядок уже такой в get_adoption_login_users)
  const pct = (logged: number, total: number) => (total > 0 ? Math.round((logged / total) * 100) : 0)
  const usersByTeam = new Map<string, AdoptionLoginUser[]>()
  for (const r of loginUsersRes.data ?? []) {
    const key = `${r.department}|${r.team ?? ''}`
    const list = usersByTeam.get(key)
    const user = { name: r.user_name, logged_in: r.logged_in }
    if (list) list.push(user)
    else usersByTeam.set(key, [user])
  }

  const deptMap = new Map<string, { total: number; logged_in: number; teams: AdoptionLoginTeam[] }>()
  for (const r of loginDeptRes.data ?? []) {
    const total = Number(r.total)
    const logged = Number(r.logged_in)
    let dept = deptMap.get(r.department)
    if (!dept) { dept = { total: 0, logged_in: 0, teams: [] }; deptMap.set(r.department, dept) }
    dept.total += total
    dept.logged_in += logged
    dept.teams.push({
      team: r.team,
      total,
      logged_in: logged,
      pct: pct(logged, total),
      users: usersByTeam.get(`${r.department}|${r.team ?? ''}`) ?? [],
    })
  }
  const loginByDepartment: AdoptionLoginDepartment[] = [...deptMap.entries()]
    .map(([department, d]) => ({
      department,
      total: d.total,
      logged_in: d.logged_in,
      pct: pct(d.logged_in, d.total),
      teams: d.teams.sort((a, b) => a.pct - b.pct),
    }))
    .sort((a, b) => a.pct - b.pct)

  return {
    total_cohort: Number(coverageRes.data?.[0]?.total_employees ?? 0),
    users_daily: usersDaily,
    // Только рабочие дни — единичные запуски в выходные создают ложные провалы
    revit_daily: (revitRes.data ?? [])
      .filter((r) => workdays.has(r.day))
      .map((r) => ({ day: r.day, users: Number(r.users) })),
    login_by_department: loginByDepartment,
  }
}

// Объединённый блок «Дисциплина Worksection»: зелёные дни, два вида нарушений
// (доли от отслеживаемых) и эффект вовлечения
export async function getAdoptionWorksection(): Promise<AdoptionWorksectionData> {
  const supabase = createSupabaseAdminClient()
  const today = getYesterday()

  type WsDayRow = {
    day: string; tracked: string; green: string; reported: string
    green_pct: string; timely_pct: string; inwork_pct: string | null
  }
  type EffectRow = { logged_in: boolean; users: string; green_before_pct: string; green_after_pct: string }
  type ReasonDayRow = { day: string; reason_type: string; cnt: string }
  type RedUserRow = { reason_type: string; user_name: string; department: string | null; days: string }

  const [dailyRes, effectRes, reasonsRes, redUsersRes] = await Promise.all([
    supabase.rpc('get_adoption_ws_daily', {
      p_from: BEFORE_FROM,
      p_to: today,
    }) as unknown as Promise<{ data: WsDayRow[] | null; error: RpcError }>,
    supabase.rpc('get_adoption_login_effect', {
      p_to: today,
    }) as unknown as Promise<{ data: EffectRow[] | null; error: RpcError }>,
    supabase.rpc('get_adoption_red_reasons_daily', {
      p_from: BEFORE_FROM,
      p_to: today,
    }) as unknown as Promise<{ data: ReasonDayRow[] | null; error: RpcError }>,
    // Списки нарушителей — только период ПОСЛЕ (с запуска)
    supabase.rpc('get_adoption_red_users', {
      p_from: LAUNCH_DATE,
      p_to: today,
    }) as unknown as Promise<{ data: RedUserRow[] | null; error: RpcError }>,
  ])

  if (dailyRes.error) throw new Error(dailyRes.error.message)
  if (effectRes.error) throw new Error(effectRes.error.message)
  if (reasonsRes.error) throw new Error(reasonsRes.error.message)
  if (redUsersRes.error) throw new Error(redUsersRes.error.message)

  const wrongByDay = new Map<string, number>()
  for (const r of reasonsRes.data ?? []) {
    if (r.reason_type === 'wrong_status_report') wrongByDay.set(r.day, Number(r.cnt))
  }

  const rows = dailyRes.data ?? []
  const daily: AdoptionWsDay[] = rows.map((r) => {
    const tracked = Number(r.tracked)
    const wrong = wrongByDay.get(r.day) ?? 0
    const noReport = tracked - Number(r.reported)
    return {
      day: r.day,
      green_pct: Number(r.green_pct),
      wrong_task_pct: tracked > 0 ? Math.round((wrong / tracked) * 1000) / 10 : 0,
      no_report_pct: tracked > 0 ? Math.round((noReport / tracked) * 1000) / 10 : 0,
    }
  })

  // Агрегаты ДО/ПОСЛЕ — взвешенные по людям (сумма случаев / сумма отслеживаемых),
  // а не среднее дневных процентов: дни с меньшим составом не искажают итог.
  // Абсолютные счётчики в штуках врут при уменьшении состава, поэтому карточки — в долях
  function periodPct(period: WsDayRow[], num: (r: WsDayRow) => number, decimals = 0): number {
    const n = period.reduce((s, r) => s + num(r), 0)
    const d = period.reduce((s, r) => s + Number(r.tracked), 0)
    const factor = Math.pow(10, decimals)
    return d > 0 ? Math.round((n / d) * 100 * factor) / factor : 0
  }
  const beforeRows = rows.filter((r) => r.day < LAUNCH_DATE)
  const afterRows = rows.filter((r) => r.day >= LAUNCH_DATE)

  const wrongCnt = (r: WsDayRow) => wrongByDay.get(r.day) ?? 0
  const noReportCnt = (r: WsDayRow) => Number(r.tracked) - Number(r.reported)
  const perDay = (period: WsDayRow[], num: (r: WsDayRow) => number): number => {
    const days = Math.max(period.length, 1)
    return Math.round((period.reduce((s, r) => s + num(r), 0) / days) * 10) / 10
  }

  const emptyGroup: AdoptionLoginEffectGroup = { users: 0, green_before: 0, green_after: 0 }
  function toGroup(row?: EffectRow): AdoptionLoginEffectGroup {
    if (!row) return emptyGroup
    return {
      users: Number(row.users),
      green_before: Number(row.green_before_pct),
      green_after: Number(row.green_after_pct),
    }
  }
  const effects = effectRes.data ?? []

  // Списки уже отсортированы функцией по убыванию дней
  const toRedUser = (r: RedUserRow): AdoptionRedUser => ({
    name: r.user_name,
    department: r.department,
    days: Number(r.days),
  })
  const redUsers = redUsersRes.data ?? []

  return {
    green_before: periodPct(beforeRows, (r) => Number(r.green)),
    green_after: periodPct(afterRows, (r) => Number(r.green)),
    wrong_task_before: periodPct(beforeRows, wrongCnt, 1),
    wrong_task_after: periodPct(afterRows, wrongCnt, 1),
    no_report_before: periodPct(beforeRows, noReportCnt, 1),
    no_report_after: periodPct(afterRows, noReportCnt, 1),
    wrong_task_day_before: perDay(beforeRows, wrongCnt),
    wrong_task_day_after: perDay(afterRows, wrongCnt),
    no_report_day_before: perDay(beforeRows, noReportCnt),
    no_report_day_after: perDay(afterRows, noReportCnt),
    daily,
    no_report_users: redUsers.filter((r) => r.reason_type === 'red_day').map(toRedUser),
    wrong_task_users: redUsers.filter((r) => r.reason_type === 'wrong_status_report').map(toRedUser),
    logged: toGroup(effects.find((e) => e.logged_in)),
    not_logged: toGroup(effects.find((e) => !e.logged_in)),
  }
}

export async function getAdoptionPlugins(): Promise<AdoptionPluginsData> {
  const supabase = createSupabaseAdminClient()
  const today = getYesterday()

  type PluginRow = { user_email: string; work_date: string; launch_count: number }

  const [rawBaseline, rawLive, holidaysRes, transfersRes, cohortRes, coverageRes, profilesRes] = await Promise.all([
    fetchAll<PluginRow>((from, to) =>
      supabase
        .from('elk_plugin_launches_baseline')
        .select('user_email, work_date, launch_count')
        .gte('work_date', ELK_BASELINE_FROM)
        .lte('work_date', BEFORE_TO)
        .order('id')
        .range(from, to)
    ),
    fetchAll<PluginRow>((from, to) =>
      supabase
        .from('elk_plugin_launches')
        .select('user_email, work_date, launch_count')
        .gte('work_date', LAUNCH_DATE)
        .lte('work_date', today)
        .order('id')
        .range(from, to)
    ),
    supabase.from('calendar_holidays').select('date'),
    supabase.from('calendar_workdays').select('date'),
    supabase.rpc('adoption_designer_emails') as unknown as Promise<{
      data: string[] | null
      error: RpcError
    }>,
    supabase.rpc('get_adoption_coverage') as unknown as Promise<CoverageRes>,
    supabase.from('profiles').select('email'),
  ])

  if (holidaysRes.error) throw new Error(holidaysRes.error.message)
  if (transfersRes.error) throw new Error(transfersRes.error.message)
  if (cohortRes.error) throw new Error(cohortRes.error.message)
  if (coverageRes.error) throw new Error(coverageRes.error.message)
  if (profilesRes.error) throw new Error(profilesRes.error.message)

  // Все ряды фильтруются по когорте проектировщиков
  const cohortEmails = new Set((cohortRes.data ?? []).map((e) => e.toLowerCase()))
  const baseline = rawBaseline.filter((r) => cohortEmails.has(r.user_email.toLowerCase()))
  const live = rawLive.filter((r) => cohortEmails.has(r.user_email.toLowerCase()))

  const holidays = new Set((holidaysRes.data ?? []).map((r) => r.date as string))
  const transfers = new Set((transfersRes.data ?? []).map((r) => r.date as string))

  const beforeWorkdays = getWorkdayList(BEFORE_FROM, BEFORE_TO, holidays, transfers)
  const afterWorkdays = getWorkdayList(LAUNCH_DATE, today, holidays, transfers)

  // Агрегаты по рабочим дням: активные и запуски за каждый день
  const allWorkdays = getWorkdayList(ELK_BASELINE_FROM, today, holidays, transfers)
  const allWorkdaySet = new Set(allWorkdays)
  const byDay = new Map<string, { users: Set<string>; launches: number }>()
  for (const r of [...baseline, ...live]) {
    if (!allWorkdaySet.has(r.work_date)) continue
    let day = byDay.get(r.work_date)
    if (!day) { day = { users: new Set(), launches: 0 }; byDay.set(r.work_date, day) }
    day.users.add(r.user_email.toLowerCase())
    day.launches += r.launch_count
  }

  // Средние за рабочий день по окну дат (дни без запусков считаются нулями)
  function dailyAvg(from: string, to: string, num: (d: { users: Set<string>; launches: number }) => number): number {
    const days = allWorkdays.filter((d) => d >= from && d <= to)
    if (days.length === 0) return 0
    const total = days.reduce((s, d) => {
      const agg = byDay.get(d)
      return s + (agg ? num(agg) : 0)
    }, 0)
    return Math.round(total / days.length)
  }

  // Недельные агрегаты: понедельник ISO-недели → рабочие дни, активные, запуски
  function weekMonday(day: string): string {
    const d = new Date(day + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
    return d.toISOString().slice(0, 10)
  }
  const weekMap = new Map<string, { workdays: string[]; users: Set<string>; userDays: number; launches: number }>()
  for (const d of allWorkdays) {
    const wk = weekMonday(d)
    let w = weekMap.get(wk)
    if (!w) { w = { workdays: [], users: new Set(), userDays: 0, launches: 0 }; weekMap.set(wk, w) }
    w.workdays.push(d)
    const agg = byDay.get(d)
    if (agg) {
      w.userDays += agg.users.size
      w.launches += agg.launches
      for (const u of agg.users) w.users.add(u)
    }
  }
  const weeks = [...weekMap.entries()].sort(([a], [b]) => (a < b ? -1 : 1))

  // Дневной ряд для графика — с 29.06 (как остальные графики дашборда)
  const daily = allWorkdays
    .filter((d) => d >= BEFORE_FROM)
    .map((d) => {
      const agg = byDay.get(d)
      return { day: d, users: agg?.users.size ?? 0, launches: agg?.launches ?? 0 }
    })

  // Полные недели (последний рабочий день недели уже прошёл) — для метрик «на неделю»
  const fullWeeks = weeks.filter(([, w]) => w.workdays[w.workdays.length - 1] <= today && w.users.size > 0)
  function daysPerUser(filter: (week: string) => boolean): number {
    const rows = fullWeeks.filter(([wk]) => filter(wk))
    if (rows.length === 0) return 0
    const avg = rows.reduce((s, [, w]) => s + w.userDays / w.users.size, 0) / rows.length
    return Math.round(avg * 10) / 10
  }
  // Неделя запуска (29.06) смешивает ДО и ПОСЛЕ — в оба окна не входит
  const launchWeek = weekMonday(LAUNCH_DATE)
  const daysPerUserBefore = daysPerUser((wk) => wk >= JUNE_FROM && wk < launchWeek)
  const daysPerUserAfter = daysPerUser((wk) => wk > launchWeek)
  const weeklyAudience = fullWeeks.length > 0
    ? Math.round(fullWeeks.reduce((s, [, w]) => s + w.users.size, 0) / fullWeeks.length)
    : 0

  // Эффект вовлечения: доля группы, запускавшая плагины в средний рабочий день.
  // Нормировано по числу рабочих дней — периоды разной длины сравниваются честно
  function computeDailyActivePct(rows: PluginRow[], workdays: string[], group: Set<string>): number {
    if (workdays.length === 0 || group.size === 0) return 0
    const workdaySet = new Set(workdays)
    const userDays = new Set<string>()
    for (const r of rows) {
      const email = r.user_email.toLowerCase()
      if (workdaySet.has(r.work_date) && group.has(email)) userDays.add(`${r.work_date}|${email}`)
    }
    return Math.round((userDays.size / workdays.length / group.size) * 1000) / 10
  }

  const profileEmails = new Set(
    (profilesRes.data ?? [])
      .filter((p) => p.email)
      .map((p) => (p.email as string).toLowerCase()),
  )
  const loggedEmails = new Set([...cohortEmails].filter((e) => profileEmails.has(e)))
  const notLoggedEmails = new Set([...cohortEmails].filter((e) => !profileEmails.has(e)))

  return {
    daily_active_before: dailyAvg(JUNE_FROM, BEFORE_TO, (d) => d.users.size),
    daily_active_after: dailyAvg(LAUNCH_DATE, today, (d) => d.users.size),
    launches_day_before: dailyAvg(JUNE_FROM, BEFORE_TO, (d) => d.launches),
    launches_day_after: dailyAvg(LAUNCH_DATE, today, (d) => d.launches),
    days_per_user_before: daysPerUserBefore,
    days_per_user_after: daysPerUserAfter,
    weekly_audience: weeklyAudience,
    daily,
    total_cohort: Number(coverageRes.data?.[0]?.total_employees ?? 0),
    effect_logged: {
      users: loggedEmails.size,
      active_before: computeDailyActivePct(baseline, beforeWorkdays, loggedEmails),
      active_after: computeDailyActivePct(live, afterWorkdays, loggedEmails),
    },
    effect_not_logged: {
      users: notLoggedEmails.size,
      active_before: computeDailyActivePct(baseline, beforeWorkdays, notLoggedEmails),
      active_after: computeDailyActivePct(live, afterWorkdays, notLoggedEmails),
    },
  }
}

export async function getAdoptionSideEffects(
  launchDate = LAUNCH_DATE,
): Promise<AdoptionSideEffectsData> {
  const supabase = createSupabaseAdminClient()

  type CrystalStatsRow = { earners: string; spent_total: string; balance_total: string }

  const [gratitudesRes, crystalsRes, ordersRes, chatRes, cohortIdsRes, cohortEmailsRes, profilesRes] =
    await Promise.all([
      supabase
        .from('gratitudes')
        .select('sender_id, recipient_id')
        .gte('created_at', launchDate),
      supabase.rpc('get_adoption_crystal_stats', {
        p_from: launchDate,
      }) as unknown as Promise<{ data: CrystalStatsRow[] | null; error: RpcError }>,
      supabase
        .from('shop_orders')
        .select('user_id')
        .gte('created_at', launchDate)
        .neq('status', 'cancelled'),
      supabase
        .from('chat_messages')
        .select('user_id')
        .gte('created_at', launchDate)
        .eq('role', 'user'),
      supabase.rpc('adoption_designer_ids') as unknown as Promise<{
        data: string[] | null
        error: RpcError
      }>,
      supabase.rpc('adoption_designer_emails') as unknown as Promise<{
        data: string[] | null
        error: RpcError
      }>,
      supabase.from('profiles').select('user_id, email'),
    ])

  if (crystalsRes.error) throw new Error(crystalsRes.error.message)
  if (cohortIdsRes.error) throw new Error(cohortIdsRes.error.message)
  if (cohortEmailsRes.error) throw new Error(cohortEmailsRes.error.message)

  // Ключи различаются: gratitudes/shop_orders и стрики ссылаются на ws_users.id,
  // chat_messages — на profiles.user_id (auth uid); когорта profiles строится по email
  const cohortWsIds = new Set(cohortIdsRes.data ?? [])
  const cohortEmails = new Set((cohortEmailsRes.data ?? []).map((e) => e.toLowerCase()))
  const cohortProfileIds = new Set(
    (profilesRes.data ?? [])
      .filter((p) => p.email && cohortEmails.has(p.email.toLowerCase()))
      .map((p) => p.user_id),
  )

  const gratitudes = (gratitudesRes.data ?? []).filter((g) => cohortWsIds.has(g.sender_id))
  const orders = (ordersRes.data ?? []).filter((o) => cohortWsIds.has(o.user_id))
  const chats = (chatRes.data ?? []).filter((c) => cohortProfileIds.has(c.user_id))

  const crystals = crystalsRes.data?.[0]
  const earners = Number(crystals?.earners ?? 0)
  const balanceTotal = Number(crystals?.balance_total ?? 0)

  return {
    earners_count: earners,
    earners_pct: cohortWsIds.size > 0 ? Math.round((earners / cohortWsIds.size) * 100) : 0,
    spent_total: Number(crystals?.spent_total ?? 0),
    balance_total: balanceTotal,
    balance_avg: earners > 0 ? Math.round(balanceTotal / earners) : 0,
    gratitude_total: gratitudes.length,
    gratitude_senders: new Set(gratitudes.map((g) => g.sender_id)).size,
    gratitude_recipients: new Set(gratitudes.map((g) => g.recipient_id)).size,
    shop_orders_total: orders.length,
    shop_orders_unique_users: new Set(orders.map((o) => o.user_id)).size,
    chatbot_messages_total: chats.length,
    chatbot_unique_users: new Set(chats.map((c) => c.user_id)).size,
  }
}
