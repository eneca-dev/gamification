import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { crypto } from 'https://deno.land/std@0.224.0/crypto/mod.ts'
import { encodeHex } from 'https://deno.land/std@0.224.0/encoding/hex.ts'

const WS_API_URL = 'https://eneca.worksection.com/api/admin/v2'

// ID L1-задачи для сикдеев
const SICK_DAY_TASK_ID = '4905680'

interface ScheduleUser {
  id: string
  email: string
  name: string
  schedule?: Record<string, string>
}

interface WsTaskChild {
  id: string
  name: string
  status: string
  user_to?: { id: string; email: string; name: string }
  date_start?: string
  date_end?: string
}

interface SyncStats {
  target_date: string
  schedule_users: number
  schedule_rows: number
  sick_day_tasks_total: number
  sick_day_tasks_matched: number
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

/** Вчерашняя дата в YYYY-MM-DD */
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

/** Получаем расписание пользователей за конкретную дату */
async function fetchSchedule(wsApiKey: string, dateIso: string): Promise<Record<string, ScheduleUser>> {
  const wsDate = toWsDateFormat(dateIso)
  const queryParams = `action=get_users_schedule&datestart=${wsDate}&dateend=${wsDate}`
  const hash = await md5(queryParams + wsApiKey)
  const url = `${WS_API_URL}/?${queryParams}&hash=${hash}`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`WS API error: ${response.status} ${response.statusText}`)
  }

  const json = await response.json()
  if (json.status !== 'ok') {
    throw new Error(`WS API returned status: ${json.status}`)
  }

  return (json.data ?? {}) as Record<string, ScheduleUser>
}

/** Получаем дочерние задачи сикдеев */
async function fetchSickDayTasks(wsApiKey: string): Promise<WsTaskChild[]> {
  const queryParams = `action=get_task&id_task=${SICK_DAY_TASK_ID}&extra=subtasks`
  const hash = await md5(queryParams + wsApiKey)
  const url = `${WS_API_URL}/?${queryParams}&hash=${hash}`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`WS API error: ${response.status} ${response.statusText}`)
  }

  const json = await response.json()
  if (json.status !== 'ok') {
    throw new Error(`WS API returned status: ${json.status}`)
  }

  // get_task возвращает одну задачу, дочерние в child
  const task = json.data
  if (!task || !task.child) return []

  return task.child as WsTaskChild[]
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
      sick_day_tasks_total: 0,
      sick_day_tasks_matched: 0,
      sick_day_rows: 0,
      upserted: 0,
      user_errors: [],
      db_errors: [],
    }

    const now = new Date().toISOString()
    const rows: { user_id: string | null; user_email: string; absence_type: string; absence_date: string; synced_at: string }[] = []

    // ─── Источник 1: get_users_schedule за вчера ───
    const scheduleData = await fetchSchedule(wsApiKey, targetDate)

    for (const userData of Object.values(scheduleData)) {
      const email = userData.email?.toLowerCase()
      if (!email || !userData.schedule) continue
      stats.schedule_users++

      const userId = userMap.get(email) ?? null
      if (!userId) {
        stats.user_errors.push(`schedule: ${email}`)
      }

      for (const [date, type] of Object.entries(userData.schedule)) {
        let absenceType: string | null = null
        if (type === 'vacation') absenceType = 'vacation'
        else if (type === 'sick-leave') absenceType = 'sick_leave'
        else continue

        rows.push({
          user_id: userId,
          user_email: email,
          absence_type: absenceType,
          absence_date: date,
          synced_at: now,
        })
        stats.schedule_rows++
      }
    }

    // ─── Источник 2: задачи сикдеев, фильтр по вчера ───
    const allSickDayTasks = await fetchSickDayTasks(wsApiKey)
    stats.sick_day_tasks_total = allSickDayTasks.length

    for (const task of allSickDayTasks) {
      const email = task.user_to?.email?.toLowerCase()
      if (!email) continue
      if (!task.date_start || !task.date_end) continue

      // Проверяем: вчера попадает в диапазон [date_start, date_end]?
      if (targetDate < task.date_start || targetDate > task.date_end) continue

      stats.sick_day_tasks_matched++

      const userId = userMap.get(email) ?? null
      if (!userId) {
        stats.user_errors.push(`sick_day: ${email}`)
      }

      rows.push({
        user_id: userId,
        user_email: email,
        absence_type: 'sick_day',
        absence_date: targetDate,
        synced_at: now,
      })
      stats.sick_day_rows++
    }

    // ─── Upsert ───
    if (!dryRun && rows.length > 0) {
      const { error } = await supabase
        .from('ws_user_absences')
        .upsert(rows, { onConflict: 'user_email,absence_date,absence_type', ignoreDuplicates: true })
      if (error) {
        stats.db_errors.push(`upsert: ${error.message}`)
      } else {
        stats.upserted = rows.length
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
