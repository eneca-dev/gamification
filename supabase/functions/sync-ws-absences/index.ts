import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { crypto } from 'https://deno.land/std@0.224.0/crypto/mod.ts'
import { encodeHex } from 'https://deno.land/std@0.224.0/encoding/hex.ts'

const WS_API_URL = 'https://eneca.worksection.com/api/admin/v2'

// L1-задача "[Sick day]" в HR-проекте. Подзадачи под ней = индивидуальные сикдеи.
const SICK_DAY_PROJECT_ID = '130340'
const SICK_DAY_PARENT_TASK_ID = '4905680'
const SICK_DAY_PARENT_PATH = `/${SICK_DAY_PROJECT_ID}/${SICK_DAY_PARENT_TASK_ID}/`

// Окно событий для sick_day. 8d = согласованная HR граница "не раньше 7 дней до"
// + сутки буфера на таймзоны и время cron.
const SICK_DAY_EVENTS_PERIOD = '8d'

interface ScheduleUser {
  id: string
  email: string
  name: string
  schedule?: Record<string, string>
}

interface WsEvent {
  action: 'post' | 'update' | 'close' | 'reopen' | 'delete'
  object: { type: string; id: string; page: string }
  date_added: string
  user_from?: { id: string; email: string; name: string }
  new?: Record<string, unknown>
  old?: Record<string, unknown>
}

interface WsTaskFull {
  id: string
  user_to?: { id: string; email: string; name: string }
  date_start?: string
  date_end?: string
}

interface AbsenceRow {
  user_id: string | null
  user_email: string
  absence_type: 'vacation' | 'sick_leave' | 'sick_day'
  absence_date: string
  synced_at: string
  ws_task_id: string | null
}

interface SyncStats {
  target_date: string
  schedule_users: number
  schedule_rows: number
  sick_day_events_total: number
  sick_day_tasks_unique: number
  sick_day_deletes: number
  sick_day_rows: number
  upserted: number
  user_errors: string[]
  db_errors: string[]
}

/** MD5-хеш для WS Admin API */
async function md5(input: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('MD5', data)
  return encodeHex(new Uint8Array(hashBuffer))
}

/** Вчерашняя дата в YYYY-MM-DD (по локальной TZ Edge runtime — Минск) */
function getYesterday(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

/** YYYY-MM-DD → DD.MM.YYYY (формат WS API) */
function toWsDateFormat(isoDate: string): string {
  const [y, m, d] = isoDate.split('-')
  return `${d}.${m}.${y}`
}

/** Перебор дат YYYY-MM-DD от start до end включительно */
function eachDateInRange(startIso: string, endIso: string): string[] {
  const dates: string[] = []
  const start = new Date(startIso + 'T00:00:00Z')
  const end = new Date(endIso + 'T00:00:00Z')
  if (start > end) return dates
  for (const d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}

/** Расписание отпусков/больничных за конкретную дату */
async function fetchSchedule(wsApiKey: string, dateIso: string): Promise<Record<string, ScheduleUser>> {
  const wsDate = toWsDateFormat(dateIso)
  const queryParams = `action=get_users_schedule&datestart=${wsDate}&dateend=${wsDate}`
  const hash = await md5(queryParams + wsApiKey)
  const url = `${WS_API_URL}/?${queryParams}&hash=${hash}`
  const response = await fetch(url)

  if (!response.ok) throw new Error(`WS API error: ${response.status} ${response.statusText}`)
  const json = await response.json()
  if (json.status !== 'ok') throw new Error(`WS API returned status: ${json.status}`)

  return (json.data ?? {}) as Record<string, ScheduleUser>
}

/** События последних N дней по HR-проекту (для отслеживания подзадач сикдеев) */
async function fetchSickDayEvents(wsApiKey: string): Promise<WsEvent[]> {
  const queryParams = `action=get_events&period=${SICK_DAY_EVENTS_PERIOD}&id_project=${SICK_DAY_PROJECT_ID}`
  const hash = await md5(queryParams + wsApiKey)
  const url = `${WS_API_URL}/?${queryParams}&hash=${hash}`
  const response = await fetch(url)

  if (!response.ok) throw new Error(`WS API error: ${response.status} ${response.statusText}`)
  const json = await response.json()
  if (json.status !== 'ok') throw new Error(`WS API returned status: ${json.status}`)

  return (json.data ?? []) as WsEvent[]
}

/** Полная карточка задачи (без extra=subtasks — оно урезает поля у дочерних) */
async function fetchTask(wsApiKey: string, taskId: string): Promise<WsTaskFull | null> {
  const queryParams = `action=get_task&id_task=${taskId}`
  const hash = await md5(queryParams + wsApiKey)
  const url = `${WS_API_URL}/?${queryParams}&hash=${hash}`
  const response = await fetch(url)

  if (!response.ok) return null
  const json = await response.json()
  if (json.status !== 'ok') return null

  return json.data as WsTaskFull
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const syncSecret = Deno.env.get('SYNC_SECRET')!
    const authHeader = req.headers.get('Authorization')
    if (authHeader !== `Bearer ${syncSecret}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const wsApiKey = Deno.env.get('WORKSECTION_ADMIN_API_KEY')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const body = await req.json().catch(() => ({}))
    const dryRun = body.dry_run === true

    const targetDate = getYesterday()

    // Справочник пользователей
    const { data: users, error: usersErr } = await supabase
      .from('ws_users')
      .select('id, email')
    if (usersErr) throw new Error(`DB users error: ${usersErr.message}`)

    const userMap = new Map<string, string>()
    for (const u of users ?? []) {
      userMap.set(u.email.toLowerCase(), u.id)
    }

    const stats: SyncStats = {
      target_date: targetDate,
      schedule_users: 0,
      schedule_rows: 0,
      sick_day_events_total: 0,
      sick_day_tasks_unique: 0,
      sick_day_deletes: 0,
      sick_day_rows: 0,
      upserted: 0,
      user_errors: [],
      db_errors: [],
    }

    const now = new Date().toISOString()

    // ─── Источник 1: vacation / sick_leave из расписания за вчера ───
    const scheduleRows: AbsenceRow[] = []
    const scheduleData = await fetchSchedule(wsApiKey, targetDate)

    for (const userData of Object.values(scheduleData)) {
      const email = userData.email?.toLowerCase()
      if (!email || !userData.schedule) continue
      stats.schedule_users++

      const userId = userMap.get(email) ?? null
      if (!userId) stats.user_errors.push(`schedule: ${email}`)

      for (const [date, type] of Object.entries(userData.schedule)) {
        let absenceType: AbsenceRow['absence_type'] | null = null
        if (type === 'vacation') absenceType = 'vacation'
        else if (type === 'sick-leave') absenceType = 'sick_leave'
        else continue

        scheduleRows.push({
          user_id: userId,
          user_email: email,
          absence_type: absenceType,
          absence_date: date,
          synced_at: now,
          ws_task_id: null,
        })
        stats.schedule_rows++
      }
    }

    // ─── Источник 2: sick_day через get_events + get_task ───
    const events = await fetchSickDayEvents(wsApiKey)
    stats.sick_day_events_total = events.length

    const relevantEvents = events.filter(
      (e) =>
        e.object?.type === 'task' &&
        e.object?.page?.includes(SICK_DAY_PARENT_PATH) &&
        (e.action === 'post' || e.action === 'update' || e.action === 'delete')
    )

    // Последнее событие на каждый task_id
    const lastEventByTaskId = new Map<string, WsEvent>()
    const sortedEvents = [...relevantEvents].sort((a, b) =>
      a.date_added.localeCompare(b.date_added)
    )
    for (const e of sortedEvents) {
      lastEventByTaskId.set(e.object.id, e)
    }
    stats.sick_day_tasks_unique = lastEventByTaskId.size

    const sickDayRows: AbsenceRow[] = []

    for (const [taskId, lastEvent] of lastEventByTaskId) {
      if (lastEvent.action === 'delete') {
        stats.sick_day_deletes++
        continue
      }

      const task = await fetchTask(wsApiKey, taskId)
      if (!task) {
        stats.user_errors.push(`sick_day: get_task failed for ${taskId}`)
        continue
      }

      const email = task.user_to?.email?.toLowerCase()
      if (!email || !task.date_start || !task.date_end) {
        stats.user_errors.push(`sick_day: incomplete task ${taskId}`)
        continue
      }

      const userId = userMap.get(email) ?? null
      if (!userId) stats.user_errors.push(`sick_day: ${email} not in ws_users`)

      for (const date of eachDateInRange(task.date_start, task.date_end)) {
        sickDayRows.push({
          user_id: userId,
          user_email: email,
          absence_type: 'sick_day',
          absence_date: date,
          synced_at: now,
          ws_task_id: taskId,
        })
      }
    }
    stats.sick_day_rows = sickDayRows.length

    // ─── Применение в БД ───
    if (!dryRun) {
      // 1. Расписание (vacation / sick_leave) — upsert как раньше
      if (scheduleRows.length > 0) {
        const { error } = await supabase
          .from('ws_user_absences')
          .upsert(scheduleRows, {
            onConflict: 'user_email,absence_date,absence_type',
            ignoreDuplicates: true,
          })
        if (error) stats.db_errors.push(`schedule upsert: ${error.message}`)
        else stats.upserted += scheduleRows.length
      }

      // 2. Sick_day: для всех затронутых задач сначала удаляем старые записи
      //    (это покрывает и action=delete, и сужение/смещение диапазона дат после update),
      //    затем вставляем актуальные.
      const touchedTaskIds = Array.from(lastEventByTaskId.keys())
      if (touchedTaskIds.length > 0) {
        const { error: delErr } = await supabase
          .from('ws_user_absences')
          .delete()
          .in('ws_task_id', touchedTaskIds)
        if (delErr) stats.db_errors.push(`sick_day delete: ${delErr.message}`)
      }

      if (sickDayRows.length > 0) {
        const { error: insErr } = await supabase
          .from('ws_user_absences')
          .upsert(sickDayRows, {
            onConflict: 'user_email,absence_date,absence_type',
            ignoreDuplicates: true,
          })
        if (insErr) stats.db_errors.push(`sick_day insert: ${insErr.message}`)
        else stats.upserted += sickDayRows.length
      }
    }

    return new Response(
      JSON.stringify({
        success: stats.db_errors.length === 0,
        dry_run: dryRun,
        stats,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('sync-ws-absences failed:', message)

    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
