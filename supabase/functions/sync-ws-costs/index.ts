import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { crypto } from 'https://deno.land/std@0.224.0/crypto/mod.ts'
import { encodeHex } from 'https://deno.land/std@0.224.0/encoding/hex.ts'

const WS_API_URL = 'https://eneca.worksection.com/api/admin/v2'

interface WsCostEntry {
  user_from: { id: string; email: string; name: string }
  task: { id: string; name: string; page: string }
  date: string
  time: string // "HH:MM"
  comment?: string
  is_timer?: string
}

interface SyncStats {
  daily_reports_upserted: number
  unique_users_yesterday: number
  projects_processed: number
  projects_failed: number
  task_hours_upserted: number
  unique_tasks: number
  api_errors: string[]
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

/** Парсим "HH:MM" → десятичные часы */
function parseTime(time: string): number {
  const parts = time.split(':')
  if (parts.length !== 2) return 0
  const hours = parseInt(parts[0], 10)
  const minutes = parseInt(parts[1], 10)
  if (isNaN(hours) || isNaN(minutes)) return 0
  return hours + minutes / 60
}

/** Форматируем дату в DD.MM.YYYY для WS API */
function formatDateWs(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = date.getFullYear()
  return `${dd}.${mm}.${yyyy}`
}

/** Получаем записи времени из WS API */
async function fetchWsCosts(
  wsApiKey: string,
  projectId: string,
  datestart?: string,
  dateend?: string
): Promise<WsCostEntry[]> {
  let queryParams = `action=get_costs&id_project=${projectId}`
  if (datestart) queryParams += `&datestart=${datestart}`
  if (dateend) queryParams += `&dateend=${dateend}`

  const hash = await md5(queryParams + wsApiKey)
  const url = `${WS_API_URL}/?${queryParams}&hash=${hash}`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`WS API error: ${response.status} ${response.statusText}`)
  }

  const json = await response.json()

  if (json.status !== 'ok') {
    throw new Error(`WS API returned status: ${json.status}, message: ${JSON.stringify(json)}`)
  }

  return (json.data ?? []) as WsCostEntry[]
}

/** Вычисляем вчерашнюю дату */
function getYesterday(): Date {
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  return yesterday
}

// ═══════════════════════════════════════════
// Режим "daily" (4a): get_costs за вчера → ws_daily_reports
// ═══════════════════════════════════════════
async function syncDaily(
  wsApiKey: string,
  supabase: ReturnType<typeof createClient>,
  projectList: { ws_project_id: string; name: string }[],
  userMap: Map<string, string>,
  stats: SyncStats,
  dryRun: boolean,
  now: string
) {
  const yesterday = getYesterday()
  const yesterdayWs = formatDateWs(yesterday)
  const yesterdayIso = yesterday.toISOString().slice(0, 10)

  const dailyMap = new Map<string, number>()

  // Запросы за 1 день — лёгкие, можно по 5 параллельно
  const CONCURRENT = 5
  for (let i = 0; i < projectList.length; i += CONCURRENT) {
    if (i > 0) await new Promise((r) => setTimeout(r, 300))

    const batch = projectList.slice(i, i + CONCURRENT)
    const results = await Promise.allSettled(
      batch.map((p) => fetchWsCosts(wsApiKey, p.ws_project_id, yesterdayWs, yesterdayWs))
    )

    for (let j = 0; j < results.length; j++) {
      const result = results[j]
      const project = batch[j]

      if (result.status === 'rejected') {
        stats.api_errors.push(`daily ${project.ws_project_id} (${project.name}): ${result.reason}`)
        stats.projects_failed++
        continue
      }

      for (const entry of result.value) {
        const email = entry.user_from?.email?.toLowerCase()
        if (!email) continue
        const hours = parseTime(entry.time)
        dailyMap.set(email, (dailyMap.get(email) ?? 0) + hours)
      }

      stats.projects_processed++
    }
  }

  stats.unique_users_yesterday = dailyMap.size

  if (!dryRun && dailyMap.size > 0) {
    const rows = Array.from(dailyMap.entries()).map(([email, totalHours]) => {
      const userId = userMap.get(email) ?? null
      if (!userId) {
        stats.user_errors.push(`daily_report: ${email}`)
      }
      return {
        user_id: userId,
        user_email: email,
        report_date: yesterdayIso,
        total_hours: Math.round(totalHours * 100) / 100,
        synced_at: now,
      }
    })

    const BATCH = 500
    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH)
      const { error } = await supabase
        .from('ws_daily_reports')
        .upsert(chunk, { onConflict: 'user_email,report_date', ignoreDuplicates: false })
      if (error) {
        stats.db_errors.push(`daily_reports upsert batch ${i}: ${error.message}`)
      } else {
        stats.daily_reports_upserted += chunk.length
      }
    }
  }

  return yesterdayIso
}

// ═══════════════════════════════════════════
// Режим "hours" (4b): get_costs за всё время → ws_task_actual_hours
// ═══════════════════════════════════════════
async function syncHours(
  wsApiKey: string,
  supabase: ReturnType<typeof createClient>,
  projectList: { ws_project_id: string; name: string }[],
  l3TaskIds: Set<string>,
  stats: SyncStats,
  dryRun: boolean,
  now: string
) {
  const taskHoursMap = new Map<string, number>()

  // Запросы за всё время — тяжёлые, последовательно по одному
  for (const project of projectList) {
    try {
      const entries = await fetchWsCosts(wsApiKey, project.ws_project_id)

      for (const entry of entries) {
        const taskId = String(entry.task?.id)
        if (!taskId || taskId === 'undefined') continue
        // Только L3 задачи
        if (!l3TaskIds.has(taskId)) continue
        const hours = parseTime(entry.time)
        taskHoursMap.set(taskId, (taskHoursMap.get(taskId) ?? 0) + hours)
      }

      stats.projects_processed++
    } catch (err) {
      stats.api_errors.push(`hours ${project.ws_project_id} (${project.name}): ${err}`)
      stats.projects_failed++
    }
  }

  stats.unique_tasks = taskHoursMap.size

  if (!dryRun && taskHoursMap.size > 0) {
    const rows = Array.from(taskHoursMap.entries()).map(([taskId, totalHours]) => ({
      ws_task_id: taskId,
      total_hours: Math.round(totalHours * 100) / 100,
      synced_at: now,
    }))

    const BATCH = 500
    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH)
      const { error } = await supabase
        .from('ws_task_actual_hours')
        .upsert(chunk, { onConflict: 'ws_task_id', ignoreDuplicates: false })
      if (error) {
        stats.db_errors.push(`task_actual_hours upsert batch ${i}: ${error.message}`)
      } else {
        stats.task_hours_upserted += chunk.length
      }
    }
  }
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
    // mode: "daily" (4a), "hours" (4b), undefined = оба
    const mode: string | undefined = body.mode

    const [{ data: projects, error: projErr }, { data: users, error: usersErr }] = await Promise.all([
      supabase.from('ws_projects').select('ws_project_id, name').eq('status', 'active'),
      supabase.from('ws_users').select('id, email'),
    ])

    if (projErr) throw new Error(`DB projects error: ${projErr.message}`)
    if (usersErr) throw new Error(`DB users error: ${usersErr.message}`)

    const userMap = new Map<string, string>()
    for (const u of users ?? []) {
      userMap.set(u.email.toLowerCase(), u.id)
    }

    // Загружаем все L3 task_id с пагинацией (Supabase лимит 1000 строк)
    const l3TaskIds = new Set<string>()
    const PAGE = 1000
    let offset = 0
    while (true) {
      const { data, error } = await supabase
        .from('ws_tasks_l3')
        .select('ws_task_id')
        .range(offset, offset + PAGE - 1)
      if (error) throw new Error(`DB l3 tasks error: ${error.message}`)
      if (!data || data.length === 0) break
      for (const t of data) l3TaskIds.add(t.ws_task_id)
      if (data.length < PAGE) break
      offset += PAGE
    }

    const stats: SyncStats = {
      daily_reports_upserted: 0,
      unique_users_yesterday: 0,
      projects_processed: 0,
      projects_failed: 0,
      task_hours_upserted: 0,
      unique_tasks: 0,
      api_errors: [],
      user_errors: [],
      db_errors: [],
    }

    const now = new Date().toISOString()
    const projectList = projects ?? []
    let yesterdayIso = ''

    const runDaily = !mode || mode === 'daily'
    const runHours = !mode || mode === 'hours'

    // chunk: разбиваем проекты на части для hours (по 20 проектов)
    // chunk=1 → проекты 0-19, chunk=2 → 20-39, chunk=3 → 40-59, chunk=4 → 60+
    const CHUNK_SIZE = 20
    const chunk: number | undefined = body.chunk
    let projectsForHours = projectList
    let chunkInfo: string | undefined

    if (chunk && runHours) {
      const start = (chunk - 1) * CHUNK_SIZE
      const end = chunk * CHUNK_SIZE
      projectsForHours = projectList.slice(start, end)
      chunkInfo = `${chunk} (projects ${start + 1}-${Math.min(end, projectList.length)} of ${projectList.length})`
    }

    if (runDaily) {
      yesterdayIso = await syncDaily(wsApiKey, supabase, projectList, userMap, stats, dryRun, now)
    }

    if (runHours) {
      await syncHours(wsApiKey, supabase, projectsForHours, l3TaskIds, stats, dryRun, now)
    }

    return new Response(
      JSON.stringify({
        success: true,
        dry_run: dryRun,
        mode: mode ?? 'all',
        chunk: chunkInfo,
        yesterday: yesterdayIso || undefined,
        stats: {
          projects_total: projectList.length,
          projects_processed: stats.projects_processed,
          projects_failed: stats.projects_failed,
          daily_reports_upserted: stats.daily_reports_upserted,
          unique_users_yesterday: stats.unique_users_yesterday,
          task_hours_upserted: stats.task_hours_upserted,
          unique_tasks: stats.unique_tasks,
          api_errors: stats.api_errors,
          user_errors_count: stats.user_errors.length,
          user_errors: stats.user_errors.slice(0, 30),
          db_errors: stats.db_errors,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('sync-ws-costs failed:', message)

    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
