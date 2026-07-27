import { createSupabaseAdminClient } from '@/config/supabase'

import type { ExportReport, ExportSheet } from './types'

// ─────────────────────────── общие хелперы ───────────────────────────
const PAGE = 1000

type Rangeable<T> = {
  range: (a: number, b: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
}
async function fetchAll<T>(build: () => Rangeable<T>): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    if (!data?.length) break
    rows.push(...data)
    if (data.length < PAGE) break
  }
  return rows
}

const dmy = (d: string | null): string => {
  if (!d) return ''
  const [y, m, day] = String(d).slice(0, 10).split('-')
  return `${day}.${m}.${y}`
}
const pct = (a: number, b: number): number => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0)
const round1 = (x: number): number => Math.round(x * 10) / 10

const REASON: Record<string, string> = {
  red_day: 'нет отчёта',
  wrong_status_report: 'отчёт в статусе не «В работе»',
}
const STATUS: Record<string, string> = { green: 'зелёный', red: 'красный', absent: 'отсутствие' }

// строковый код отдела для имени файла: из скобок «(ВК) …» → «ВК»
const deptCode = (dept: string): string => dept.match(/^\(([^)]+)\)/)?.[1]?.trim() ?? dept.slice(0, 12)

type StatusRow = { user_id: string; date: string; status: string; red_reasons: { type: string }[] | null }
type ReportRow = { user_id: string; report_date: string; total_hours: number }
type LaunchRow = { user_email: string; work_date: string; plugin_name: string; launch_count: number }
type TxnRow = { user_id: string; coins: number; created_at: string; event_id: string | null }
type GratRow = { sender_id: string; recipient_id: string; category: string | null; message: string | null; coins_amount: number | null; created_at: string }
type CheckpointRow = { ws_task_id: string; last_checkpoint: number; percent_at_checkpoint: number; assignee_id_at_checkpoint: string }
type UserRow = { id: string; first_name: string | null; last_name: string | null; email: string; team: string | null; department: string | null }
type StreakRow = { user_id: string; current_streak: number }

const fioOf = (p: { first_name: string | null; last_name: string | null }) =>
  `${p.last_name ?? ''} ${p.first_name ?? ''}`.trim()

// плагины за период — объединяем историческую и живую таблицы
async function fetchLaunches(from: string, to: string): Promise<LaunchRow[]> {
  const supabase = createSupabaseAdminClient()
  const cols = 'user_email, work_date, plugin_name, launch_count'
  const [base, live] = await Promise.all([
    fetchAll<LaunchRow>(() => supabase.from('elk_plugin_launches_baseline').select(cols).gte('work_date', from).lte('work_date', to).order('id')),
    fetchAll<LaunchRow>(() => supabase.from('elk_plugin_launches').select(cols).gte('work_date', from).lte('work_date', to).order('id')),
  ])
  return [...base, ...live]
}

// ═══════════════════════ ОТЧЁТ ПО СОТРУДНИКУ ═══════════════════════
export async function getEmployeeReport(userId: string, from: string, to: string): Promise<ExportReport> {
  const supabase = createSupabaseAdminClient()
  const user = (await supabase.from('ws_users').select('id, first_name, last_name, email, team, department').eq('id', userId).single()).data as UserRow | null
  if (!user) throw new Error('Сотрудник не найден')
  const email = user.email.toLowerCase()

  const [profile, balance, wsStreak, revitStreak, statuses, reports, reportTasks, txns, grats, allLaunches] = await Promise.all([
    supabase.from('profiles').select('email').ilike('email', email).maybeSingle(),
    supabase.from('gamification_balances').select('total_coins').eq('user_id', userId).maybeSingle(),
    supabase.from('ws_user_streaks_effective').select('current_streak, longest_streak').eq('user_id', userId).maybeSingle(),
    supabase.from('revit_user_streaks_effective').select('current_streak, longest_streak').eq('user_id', userId).maybeSingle(),
    fetchAll<StatusRow>(() => supabase.from('ws_daily_statuses').select('user_id, date, status, red_reasons').eq('user_id', userId).gte('date', from).lte('date', to).order('date')),
    fetchAll<ReportRow>(() => supabase.from('ws_daily_reports').select('user_id, report_date, total_hours').eq('user_id', userId).gte('report_date', from).lte('report_date', to).order('report_date')),
    fetchAll<{ cost_date: string; ws_task_id: string; hours: number }>(() => supabase.from('ws_daily_report_tasks').select('cost_date, ws_task_id, hours').eq('user_id', userId).gte('cost_date', from).lte('cost_date', to).order('cost_date')),
    fetchAll<TxnRow>(() => supabase.from('gamification_transactions').select('user_id, coins, created_at, event_id').eq('user_id', userId).gte('created_at', from).lte('created_at', `${to}T23:59:59`).order('created_at')),
    fetchAll<GratRow>(() => supabase.from('gratitudes').select('sender_id, recipient_id, category, message, coins_amount, created_at').or(`sender_id.eq.${userId},recipient_id.eq.${userId}`).order('created_at')),
    fetchLaunches(from, to),
  ])
  const launches = allLaunches.filter((e) => e.user_email.toLowerCase() === email)

  // задачи/проекты для списаний
  const taskIds = [...new Set(reportTasks.map((t) => t.ws_task_id))]
  const tasks = taskIds.length ? ((await supabase.from('ws_tasks_l3').select('ws_task_id, name, custom_status, ws_project_id').in('ws_task_id', taskIds)).data ?? []) : []
  const taskMap = new Map(tasks.map((t) => [t.ws_task_id as string, t]))
  const projIds = [...new Set(tasks.map((t) => t.ws_project_id as string))]
  const projects = projIds.length ? ((await supabase.from('ws_projects').select('ws_project_id, name').in('ws_project_id', projIds)).data ?? []) : []
  const projMap = new Map(projects.map((p) => [p.ws_project_id as string, p.name as string]))

  // расшифровка событий транзакций
  const eventIds = [...new Set(txns.map((t) => t.event_id).filter(Boolean) as string[])]
  const logs = eventIds.length ? ((await supabase.from('gamification_event_logs').select('id, event_type').in('id', eventIds)).data ?? []) : []
  const logMap = new Map(logs.map((l) => [l.id as string, l.event_type as string]))
  const types = (await supabase.from('gamification_event_types').select('key, name')).data ?? []
  const typeName = new Map(types.map((t) => [t.key as string, t.name as string]))
  const eventLabel = (id: string | null) => (id && logMap.get(id) ? (typeName.get(logMap.get(id)!) ?? logMap.get(id)!) : '—')

  // имена коллег для благодарностей
  const peopleIds = [...new Set(grats.flatMap((g) => [g.sender_id, g.recipient_id]))]
  const people = peopleIds.length ? ((await supabase.from('ws_users').select('id, first_name, last_name').in('id', peopleIds)).data ?? []) : []
  const nameMap = new Map(people.map((p) => [p.id as string, fioOf(p as UserRow)]))
  const reportByDate = new Map(reports.map((r) => [r.report_date, r.total_hours]))

  // назначенные задачи + снимки процента + бюджет-чекпоинты
  const assigned = (await supabase.from('ws_tasks_l3').select('ws_task_id, name, ws_project_id, max_time').eq('assignee_id', userId)).data ?? []
  const assignedMap = new Map(assigned.map((t) => [t.ws_task_id as string, t]))
  const aProjIds = [...new Set(assigned.map((t) => t.ws_project_id as string))]
  const aProjects = aProjIds.length ? ((await supabase.from('ws_projects').select('ws_project_id, name').in('ws_project_id', aProjIds)).data ?? []) : []
  const aProjMap = new Map(aProjects.map((p) => [p.ws_project_id as string, p.name as string]))
  const assignedIds = assigned.map((t) => t.ws_task_id as string)

  const snaps: { ws_task_id: string; snapshot_date: string; percent: number }[] = []
  for (let i = 0; i < assignedIds.length; i += 300) {
    const chunk = assignedIds.slice(i, i + 300)
    snaps.push(...await fetchAll<{ ws_task_id: string; snapshot_date: string; percent: number }>(() =>
      supabase.from('ws_task_percent_snapshots').select('ws_task_id, snapshot_date, percent').in('ws_task_id', chunk).gte('snapshot_date', from).lte('snapshot_date', to).order('ws_task_id').order('snapshot_date')))
  }
  const checkpoints = assignedIds.length ? ((await supabase.from('ws_task_budget_checkpoints').select('ws_task_id, last_checkpoint, percent_at_checkpoint, assignee_id_at_checkpoint').eq('assignee_id_at_checkpoint', userId)).data ?? []) as CheckpointRow[] : []

  // ── листы ──
  const sheets: ExportSheet[] = []
  sheets.push({
    name: '1. Профиль',
    columns: [{ header: 'ФИО' }, { header: 'Отдел' }, { header: 'Команда' }, { header: 'Email' }, { header: 'Вошёл в приложение' }, { header: 'Баланс кристаллов', num: true }, { header: 'WS-стрик (текущий)', num: true }, { header: 'WS-стрик (рекорд)', num: true }, { header: 'Revit-стрик (текущий)', num: true }, { header: 'Revit-стрик (рекорд)', num: true }],
    rows: [[fioOf(user), user.department ?? '—', user.team ?? '—', user.email, profile.data ? 'да' : 'нет', balance.data?.total_coins ?? 0, wsStreak.data?.current_streak ?? 0, wsStreak.data?.longest_streak ?? 0, revitStreak.data?.current_streak ?? 0, revitStreak.data?.longest_streak ?? 0]],
  })
  sheets.push({
    name: '2. WS вердикты по дням',
    columns: [{ header: 'Дата' }, { header: 'Статус' }, { header: 'Причины красного' }, { header: 'Отчёт сдан' }, { header: 'Часов за день', num: true }],
    rows: statuses.map((s) => {
      const reasons = [...new Set((s.red_reasons ?? []).map((r) => REASON[r.type] ?? r.type))].join(', ')
      const hrs = reportByDate.get(s.date)
      return [dmy(s.date), STATUS[s.status] ?? s.status, reasons, hrs != null ? 'да' : 'нет', hrs ?? null]
    }),
  })
  sheets.push({
    name: '3. WS отчёты (история)',
    columns: [{ header: 'Дата' }, { header: 'Часов списано', num: true }],
    rows: reports.map((r) => [dmy(r.report_date), r.total_hours]),
  })
  sheets.push({
    name: '4. WS задачи и проекты',
    columns: [{ header: 'Дата' }, { header: 'Проект' }, { header: 'Задача' }, { header: 'Статус задачи' }, { header: 'Часов', num: true }],
    rows: reportTasks.map((t) => {
      const task = taskMap.get(t.ws_task_id)
      return [dmy(t.cost_date), task ? (projMap.get(task.ws_project_id as string) ?? '') : '', (task?.name as string) ?? t.ws_task_id, (task?.custom_status as string) ?? '', t.hours]
    }),
  })
  // метки % (чекпоинты) — изменения
  const byTask = new Map<string, { snapshot_date: string; percent: number }[]>()
  for (const s of snaps) { if (!byTask.has(s.ws_task_id)) byTask.set(s.ws_task_id, []); byTask.get(s.ws_task_id)!.push(s) }
  const changes: (string | number | null)[][] = []
  for (const [tid, arr] of byTask) {
    let prev: number | null = null
    for (const s of arr) {
      if (prev !== null && s.percent !== prev) {
        const t = assignedMap.get(tid)
        changes.push([dmy(s.snapshot_date), t ? (aProjMap.get(t.ws_project_id as string) ?? '') : '', (t?.name as string) ?? tid, prev, s.percent])
      }
      prev = s.percent
    }
  }
  changes.sort((a, b) => String(a[0]).split('.').reverse().join().localeCompare(String(b[0]).split('.').reverse().join()))
  sheets.push({ name: '5. WS метки % (чекпоинты)', columns: [{ header: 'Дата' }, { header: 'Проект' }, { header: 'Задача' }, { header: 'Было %', num: true }, { header: 'Стало %', num: true }], rows: changes })
  sheets.push({
    name: '6. WS все снимки % (сырые)',
    columns: [{ header: 'Дата' }, { header: 'Проект' }, { header: 'Задача' }, { header: 'Процент', num: true }],
    rows: snaps.map((s) => { const t = assignedMap.get(s.ws_task_id); return [dmy(s.snapshot_date), t ? (aProjMap.get(t.ws_project_id as string) ?? '') : '', (t?.name as string) ?? s.ws_task_id, s.percent] }),
  })
  const cpRows = checkpoints.map((c) => { const t = assignedMap.get(c.ws_task_id); return [t ? (aProjMap.get(t.ws_project_id as string) ?? '') : '', (t?.name as string) ?? c.ws_task_id, Number(t?.max_time) || 0, c.last_checkpoint, c.percent_at_checkpoint, c.last_checkpoint - c.percent_at_checkpoint] }).sort((a, b) => Number(b[3]) - Number(a[3]))
  sheets.push({ name: '7. WS бюджет-чекпоинты', columns: [{ header: 'Проект' }, { header: 'Задача' }, { header: 'План (часы)', num: true }, { header: 'Порог, % плана', num: true }, { header: 'Метка на пороге, %', num: true }, { header: 'Разрыв', num: true }], rows: cpRows })
  sheets.push({ name: '8. Ревит плагины', columns: [{ header: 'Дата' }, { header: 'Плагин' }, { header: 'Запусков', num: true }], rows: launches.map((e) => [dmy(e.work_date), e.plugin_name, e.launch_count]) })
  sheets.push({ name: '9. Кристаллы', columns: [{ header: 'Дата и время' }, { header: 'Событие' }, { header: 'Кристаллов', num: true }], rows: txns.map((t) => [t.created_at.slice(0, 16).replace('T', ' '), eventLabel(t.event_id), t.coins]) })
  sheets.push({
    name: '10. Благодарности',
    columns: [{ header: 'Дата' }, { header: 'Направление' }, { header: 'Коллега' }, { header: 'Категория' }, { header: 'Сообщение' }],
    rows: grats.map((g) => { const sent = g.sender_id === userId; return [dmy(g.created_at), sent ? 'отправил' : 'получил', nameMap.get(sent ? g.recipient_id : g.sender_id) ?? '', g.category ?? '', g.message ?? ''] }),
  })

  return { filename: `внедрение_сотрудник_${fioOf(user).replace(/\s+/g, '_')}_${from}_${to}.xlsx`, sheets }
}

// ─────── общая агрегация по людям (для отдела и компании) ───────
interface PersonAgg { green: number; red: number; noReport: number; wrongStatus: number; hours: number; plugDays: Set<string>; launches: number; plugins: Set<string>; earned: number; spent: number; sent: number; received: number }

async function loadOrgData(from: string, to: string, people: UserRow[]) {
  const supabase = createSupabaseAdminClient()
  const ids = new Set(people.map((p) => p.id))
  const emails = new Set(people.map((p) => p.email.toLowerCase()))
  const emailToId = new Map(people.map((p) => [p.email.toLowerCase(), p.id]))

  const [profiles, balances, wsStreaks, revitStreaks, statuses, reports, txns, grats, launches] = await Promise.all([
    fetchAll<{ email: string }>(() => createSupabaseAdminClient().from('profiles').select('email')),
    fetchAll<{ user_id: string; total_coins: number }>(() => supabase.from('gamification_balances').select('user_id, total_coins')),
    fetchAll<StreakRow>(() => supabase.from('ws_user_streaks_effective').select('user_id, current_streak')),
    fetchAll<StreakRow>(() => supabase.from('revit_user_streaks_effective').select('user_id, current_streak')),
    fetchAll<StatusRow>(() => supabase.from('ws_daily_statuses').select('user_id, date, status, red_reasons').gte('date', from).lte('date', to).order('date')),
    fetchAll<ReportRow>(() => supabase.from('ws_daily_reports').select('user_id, report_date, total_hours').gte('report_date', from).lte('report_date', to)),
    fetchAll<TxnRow>(() => supabase.from('gamification_transactions').select('user_id, coins, created_at, event_id').gte('created_at', from).lte('created_at', `${to}T23:59:59`)),
    fetchAll<GratRow>(() => supabase.from('gratitudes').select('sender_id, recipient_id, category, message, coins_amount, created_at')),
    fetchLaunches(from, to),
  ])

  const loggedIn = new Set(profiles.filter((p) => p.email && emails.has(p.email.toLowerCase())).map((p) => p.email.toLowerCase()))
  const balById = new Map(balances.filter((b) => ids.has(b.user_id)).map((b) => [b.user_id, b.total_coins]))
  const wsStreakById = new Map(wsStreaks.filter((s) => ids.has(s.user_id)).map((s) => [s.user_id, s.current_streak]))
  const rvStreakById = new Map(revitStreaks.filter((s) => ids.has(s.user_id)).map((s) => [s.user_id, s.current_streak]))

  const P = new Map<string, PersonAgg>(people.map((p) => [p.id, { green: 0, red: 0, noReport: 0, wrongStatus: 0, hours: 0, plugDays: new Set(), launches: 0, plugins: new Set(), earned: 0, spent: 0, sent: 0, received: 0 }]))
  for (const s of statuses) {
    const a = P.get(s.user_id); if (!a) continue
    if (s.status === 'green') a.green++
    else if (s.status === 'red') { a.red++; const t = new Set((s.red_reasons ?? []).map((r) => r.type)); if (t.has('red_day')) a.noReport++; if (t.has('wrong_status_report')) a.wrongStatus++ }
  }
  for (const r of reports) { const a = P.get(r.user_id); if (a) a.hours += Number(r.total_hours) || 0 }
  for (const e of launches) { const id = emailToId.get(e.user_email.toLowerCase()); const a = id ? P.get(id) : undefined; if (!a) continue; a.plugDays.add(e.work_date); a.launches += e.launch_count; a.plugins.add(e.plugin_name) }
  for (const t of txns) { const a = P.get(t.user_id); if (!a) continue; if (t.coins > 0) a.earned += t.coins; else a.spent += -t.coins }
  for (const g of grats) { const s = P.get(g.sender_id); if (s) s.sent++; const r = P.get(g.recipient_id); if (r) r.received++ }

  const activeByDay = new Map<string, Set<string>>(); const launchByDay = new Map<string, number>()
  for (const e of launches) { const em = e.user_email.toLowerCase(); if (!emails.has(em)) continue; if (!activeByDay.has(e.work_date)) activeByDay.set(e.work_date, new Set()); activeByDay.get(e.work_date)!.add(em); launchByDay.set(e.work_date, (launchByDay.get(e.work_date) || 0) + e.launch_count) }

  return { ids, loggedIn, balById, wsStreakById, rvStreakById, P, statuses, activeByDay, launchByDay, grats, launches }
}

function summarySheet(title: string, people: UserRow[], d: Awaited<ReturnType<typeof loadOrgData>>, from: string, to: string, extra: [string, string | number][]): ExportSheet {
  const tot = { green: 0, red: 0, noReport: 0, wrongStatus: 0, earned: 0, spent: 0, sent: 0 }
  for (const a of d.P.values()) { tot.green += a.green; tot.red += a.red; tot.noReport += a.noReport; tot.wrongStatus += a.wrongStatus; tot.earned += a.earned; tot.spent += a.spent; tot.sent += a.sent }
  const logged = people.filter((p) => d.loggedIn.has(p.email.toLowerCase())).length
  const balTot = [...d.balById.values()].reduce((s, v) => s + (v || 0), 0)
  const avgActive = d.activeByDay.size ? Math.round([...d.activeByDay.values()].reduce((s, v) => s + v.size, 0) / d.activeByDay.size) : 0
  const avgLaunch = d.launchByDay.size ? Math.round([...d.launchByDay.values()].reduce((s, v) => s + v, 0) / d.launchByDay.size) : 0
  const wsHold = people.filter((p) => (d.wsStreakById.get(p.id) ?? 0) >= 1).length
  const rvHold = people.filter((p) => (d.rvStreakById.get(p.id) ?? 0) >= 1).length
  const rows: [string, string | number][] = [
    ['Период', `с ${dmy(from)} по ${dmy(to)}`],
    ...extra,
    ['Вошли в приложение', `${logged} (${pct(logged, people.length)}%)`],
    ['Доля «зелёных» дней', `${pct(tot.green, tot.green + tot.red)}%`],
    ['Красных дней всего', tot.red],
    ['— из них «нет отчёта»', tot.noReport],
    ['— из них «неверный статус»', tot.wrongStatus],
    ['Активных в плагинах (среднее/день)', avgActive],
    ['Запусков плагинов (среднее/день)', avgLaunch],
    ['Кристаллов заработано', tot.earned],
    ['Кристаллов потрачено', tot.spent],
    ['Кристаллов на балансах', balTot],
    ['Благодарностей отправлено', tot.sent],
    ['Держат WS-стрик', wsHold],
    ['Держат Revit-стрик', rvHold],
  ]
  return { name: title, columns: [{ header: 'Показатель' }, { header: 'Значение' }], rows }
}

function peopleSheet(people: UserRow[], d: Awaited<ReturnType<typeof loadOrgData>>, withDept: boolean): ExportSheet {
  const cols = [{ header: 'ФИО' }, ...(withDept ? [{ header: 'Отдел' }] : []), { header: 'Команда' }, { header: 'Вошёл' }, { header: 'Зелёных дней', num: true }, { header: 'Красных дней', num: true }, { header: '% зелёных', num: true }, { header: 'Нет отчёта (дней)', num: true }, { header: 'Неверный статус (дней)', num: true }, { header: 'Часов списано', num: true }, { header: 'Дней с плагинами', num: true }, { header: 'Запусков', num: true }, { header: 'Разных плагинов', num: true }, { header: 'Заработано 💎', num: true }, { header: 'Баланс 💎', num: true }, { header: 'Благодарн. отпр.', num: true }, { header: 'получ.', num: true }, { header: 'WS-стрик', num: true }, { header: 'Revit-стрик', num: true }]
  const rows = people.map((p) => {
    const a = d.P.get(p.id)!
    return [fioOf(p), ...(withDept ? [p.department ?? '—'] : []), p.team ?? '—', d.loggedIn.has(p.email.toLowerCase()) ? 'да' : 'нет', a.green, a.red, pct(a.green, a.green + a.red), a.noReport, a.wrongStatus, round1(a.hours), a.plugDays.size, a.launches, a.plugins.size, a.earned, d.balById.get(p.id) ?? 0, a.sent, a.received, d.wsStreakById.get(p.id) ?? 0, d.rvStreakById.get(p.id) ?? 0]
  }).sort((x, y) => Number(y[withDept ? 6 : 5]) - Number(x[withDept ? 6 : 5]))
  return { name: '2. Сотрудники', columns: cols, rows }
}

function dynamicsSheet(d: Awaited<ReturnType<typeof loadOrgData>>): ExportSheet {
  const D = new Map<string, { tracked: number; green: number; noReport: number; wrong: number }>()
  for (const s of d.statuses) {
    if (!d.ids.has(s.user_id) || (s.status !== 'green' && s.status !== 'red')) continue
    if (!D.has(s.date)) D.set(s.date, { tracked: 0, green: 0, noReport: 0, wrong: 0 })
    const x = D.get(s.date)!; x.tracked++
    if (s.status === 'green') x.green++
    else { const t = new Set((s.red_reasons ?? []).map((r) => r.type)); if (t.has('red_day')) x.noReport++; if (t.has('wrong_status_report')) x.wrong++ }
  }
  return {
    name: '3. Динамика по дням',
    columns: [{ header: 'Дата' }, { header: 'Оценивалось (без отпусков)', num: true }, { header: 'Зелёных', num: true }, { header: '% зелёных', num: true }, { header: 'Нет отчёта', num: true }, { header: 'Неверный статус', num: true }, { header: 'Активных в плагинах', num: true }, { header: 'Запусков', num: true }],
    rows: [...D.keys()].sort().map((day) => { const x = D.get(day)!; return [dmy(day), x.tracked, x.green, pct(x.green, x.tracked), x.noReport, x.wrong, d.activeByDay.get(day)?.size ?? 0, d.launchByDay.get(day) ?? 0] }),
  }
}

function violationsSheet(people: UserRow[], d: Awaited<ReturnType<typeof loadOrgData>>, withDept: boolean): ExportSheet {
  const fioById = new Map(people.map((p) => [p.id, fioOf(p)]))
  const deptById = new Map(people.map((p) => [p.id, p.department ?? '—']))
  const rows: (string | number)[][] = []
  for (const s of d.statuses) {
    if (!d.ids.has(s.user_id) || s.status !== 'red') continue
    for (const type of new Set((s.red_reasons ?? []).map((r) => r.type)))
      rows.push(withDept ? [fioById.get(s.user_id) ?? '', deptById.get(s.user_id) ?? '', dmy(s.date), REASON[type] ?? type] : [fioById.get(s.user_id) ?? '', dmy(s.date), REASON[type] ?? type])
  }
  rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])))
  return { name: '5. Нарушения (детально)', columns: withDept ? [{ header: 'ФИО' }, { header: 'Отдел' }, { header: 'Дата' }, { header: 'Причина' }] : [{ header: 'ФИО' }, { header: 'Дата' }, { header: 'Причина' }], rows }
}

async function overBudgetSheet(people: UserRow[]): Promise<ExportSheet> {
  const supabase = createSupabaseAdminClient()
  const ids = new Set(people.map((p) => p.id))
  const fioById = new Map(people.map((p) => [p.id, fioOf(p)]))
  const deptById = new Map(people.map((p) => [p.id, p.department ?? '—']))
  const cps = (await fetchAll<CheckpointRow>(() => supabase.from('ws_task_budget_checkpoints').select('ws_task_id, last_checkpoint, percent_at_checkpoint, assignee_id_at_checkpoint').gte('last_checkpoint', 100))).filter((c) => ids.has(c.assignee_id_at_checkpoint))
  const taskIds = [...new Set(cps.map((c) => c.ws_task_id))]
  const tasks: { ws_task_id: string; name: string; ws_project_id: string; max_time: number | null }[] = []
  for (let i = 0; i < taskIds.length; i += 300) tasks.push(...((await supabase.from('ws_tasks_l3').select('ws_task_id, name, ws_project_id, max_time').in('ws_task_id', taskIds.slice(i, i + 300))).data ?? []) as typeof tasks)
  const taskMap = new Map(tasks.map((t) => [t.ws_task_id, t]))
  const projIds = [...new Set(tasks.map((t) => t.ws_project_id))]
  const projects: { ws_project_id: string; name: string }[] = []
  for (let i = 0; i < projIds.length; i += 300) projects.push(...((await supabase.from('ws_projects').select('ws_project_id, name').in('ws_project_id', projIds.slice(i, i + 300))).data ?? []) as typeof projects)
  const projMap = new Map(projects.map((p) => [p.ws_project_id, p.name]))
  const rows = cps.map((c) => { const t = taskMap.get(c.ws_task_id); return [fioById.get(c.assignee_id_at_checkpoint) ?? '', deptById.get(c.assignee_id_at_checkpoint) ?? '', t ? (projMap.get(t.ws_project_id) ?? '') : '', t?.name ?? c.ws_task_id, Number(t?.max_time) || 0, c.last_checkpoint, c.percent_at_checkpoint, c.last_checkpoint - c.percent_at_checkpoint] as (string | number)[] }).sort((a, b) => Number(b[7]) - Number(a[7]))
  if (rows.length === 0) rows.push(['— нет задач с перерасходом: плановое время задано лишь у части задач —', '', '', '', '', '', '', ''])
  return { name: '6. Задачи с перерасходом', columns: [{ header: 'ФИО' }, { header: 'Отдел' }, { header: 'Проект' }, { header: 'Задача' }, { header: 'План (часы)', num: true }, { header: 'Порог, % плана', num: true }, { header: 'Метка, %', num: true }, { header: 'Разрыв', num: true }], rows }
}

function pluginsSheet(d: Awaited<ReturnType<typeof loadOrgData>>, emails: Set<string>): ExportSheet {
  const PL = new Map<string, { launches: number; users: Set<string> }>()
  for (const e of d.launches) { const em = e.user_email.toLowerCase(); if (!emails.has(em)) continue; if (!PL.has(e.plugin_name)) PL.set(e.plugin_name, { launches: 0, users: new Set() }); const x = PL.get(e.plugin_name)!; x.launches += e.launch_count; x.users.add(em) }
  return { name: '7. Плагины по типам', columns: [{ header: 'Плагин' }, { header: 'Запусков', num: true }, { header: 'Пользователей', num: true }], rows: [...PL.entries()].map(([name, x]) => [name, x.launches, x.users.size]).sort((a, b) => Number(b[1]) - Number(a[1])) }
}

async function gratitudesSheet(people: UserRow[], d: Awaited<ReturnType<typeof loadOrgData>>): Promise<ExportSheet> {
  const supabase = createSupabaseAdminClient()
  const fioById = new Map(people.map((p) => [p.id, fioOf(p)]))
  const otherIds = [...new Set(d.grats.flatMap((g) => [g.sender_id, g.recipient_id]).filter((id) => !fioById.has(id)))]
  for (let i = 0; i < otherIds.length; i += 300) for (const o of ((await supabase.from('ws_users').select('id, first_name, last_name').in('id', otherIds.slice(i, i + 300))).data ?? [])) fioById.set(o.id as string, fioOf(o as UserRow))
  return { name: '8. Благодарности (детально)', columns: [{ header: 'Дата' }, { header: 'От' }, { header: 'Кому' }, { header: 'Категория' }, { header: 'Сообщение' }], rows: d.grats.filter((g) => d.ids.has(g.sender_id)).map((g) => [dmy(g.created_at), fioById.get(g.sender_id) ?? '', fioById.get(g.recipient_id) ?? '', g.category ?? '', g.message ?? '']) }
}

// ═══════════════════════ ОТЧЁТ ПО ОТДЕЛУ ═══════════════════════
export async function getDepartmentReport(department: string, from: string, to: string): Promise<ExportReport> {
  const supabase = createSupabaseAdminClient()
  const people = (await fetchAll<UserRow>(() => supabase.from('ws_users').select('id, first_name, last_name, email, team, department').eq('department', department).eq('is_active', true).order('last_name')))
  if (people.length === 0) throw new Error('В отделе нет активных сотрудников')
  const emails = new Set(people.map((p) => p.email.toLowerCase()))
  const d = await loadOrgData(from, to, people)

  const tasksTotal = (await supabase.from('ws_tasks_l3').select('id', { count: 'exact', head: true }).in('assignee_id', people.map((p) => p.id))).count ?? 0
  const tasksPlan = (await supabase.from('ws_tasks_l3').select('id', { count: 'exact', head: true }).in('assignee_id', people.map((p) => p.id)).gt('max_time', 0)).count ?? 0

  // лист «Команды»
  const T = new Map<string, { size: number; logged: number; green: number; red: number; launches: number; earned: number }>()
  for (const p of people) {
    const key = p.team || '—'
    if (!T.has(key)) T.set(key, { size: 0, logged: 0, green: 0, red: 0, launches: 0, earned: 0 })
    const t = T.get(key)!; const a = d.P.get(p.id)!
    t.size++; if (d.loggedIn.has(p.email.toLowerCase())) t.logged++
    t.green += a.green; t.red += a.red; t.launches += a.launches; t.earned += a.earned
  }
  const teamsSheet: ExportSheet = {
    name: '4. Команды',
    columns: [{ header: 'Команда' }, { header: 'Размер', num: true }, { header: 'Вошли' }, { header: '% зелёных', num: true }, { header: 'Красных/чел', num: true }, { header: 'Запусков/чел', num: true }, { header: '💎/чел', num: true }],
    rows: [...T.entries()].map(([name, t]) => [name, t.size, `${t.logged} (${pct(t.logged, t.size)}%)`, pct(t.green, t.green + t.red), round1(t.red / t.size), round1(t.launches / t.size), Math.round(t.earned / t.size)]).sort((a, b) => Number(b[3]) - Number(a[3])),
  }

  const sheets: ExportSheet[] = [
    summarySheet('1. Сводка отдела', people, d, from, to, [['Отдел', department], ['Сотрудников', people.length], ['Задач у отдела', tasksTotal], ['— с плановым временем', `${tasksPlan} (${pct(tasksPlan, tasksTotal)}%)`]]),
    peopleSheet(people, d, false),
    dynamicsSheet(d),
    teamsSheet,
    violationsSheet(people, d, false),
    await overBudgetSheet(people),
    pluginsSheet(d, emails),
    await gratitudesSheet(people, d),
  ]
  return { filename: `внедрение_отдел_${deptCode(department)}_${from}_${to}.xlsx`, sheets }
}

// ═══════════════════════ ОТЧЁТ ПО КОМПАНИИ ═══════════════════════
export async function getCompanyReport(from: string, to: string): Promise<ExportReport> {
  const supabase = createSupabaseAdminClient()
  const people = await fetchAll<UserRow>(() => supabase.from('ws_users').select('id, first_name, last_name, email, team, department').eq('is_active', true).order('last_name'))
  const emails = new Set(people.map((p) => p.email.toLowerCase()))
  const d = await loadOrgData(from, to, people)

  // лист «По отделам»
  const DEP = new Map<string, { size: number; logged: number; green: number; red: number; noReport: number; wrong: number; launches: number; earned: number }>()
  for (const p of people) {
    const key = p.department || '—'
    if (!DEP.has(key)) DEP.set(key, { size: 0, logged: 0, green: 0, red: 0, noReport: 0, wrong: 0, launches: 0, earned: 0 })
    const t = DEP.get(key)!; const a = d.P.get(p.id)!
    t.size++; if (d.loggedIn.has(p.email.toLowerCase())) t.logged++
    t.green += a.green; t.red += a.red; t.noReport += a.noReport; t.wrong += a.wrongStatus; t.launches += a.launches; t.earned += a.earned
  }
  const byDeptSheet: ExportSheet = {
    name: '4. По отделам',
    columns: [{ header: 'Отдел' }, { header: 'Размер', num: true }, { header: 'Вошли' }, { header: '% зелёных', num: true }, { header: 'Нет отчёта/чел', num: true }, { header: 'Неверный статус/чел', num: true }, { header: 'Запусков/чел', num: true }, { header: '💎/чел', num: true }],
    rows: [...DEP.entries()].map(([name, t]) => [name, t.size, `${t.logged} (${pct(t.logged, t.size)}%)`, pct(t.green, t.green + t.red), round1(t.noReport / t.size), round1(t.wrong / t.size), round1(t.launches / t.size), Math.round(t.earned / t.size)]).sort((a, b) => Number(b[3]) - Number(a[3])),
  }

  const sheets: ExportSheet[] = [
    summarySheet('1. Сводка компании', people, d, from, to, [['Активных сотрудников', people.length], ['Отделов', new Set(people.map((p) => p.department)).size]]),
    peopleSheet(people, d, true),
    dynamicsSheet(d),
    byDeptSheet,
    violationsSheet(people, d, true),
    await overBudgetSheet(people),
    pluginsSheet(d, emails),
    await gratitudesSheet(people, d),
  ]
  return { filename: `внедрение_компания_${from}_${to}.xlsx`, sheets }
}
