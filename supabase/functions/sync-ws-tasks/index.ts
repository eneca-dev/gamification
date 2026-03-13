import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { crypto } from 'https://deno.land/std@0.224.0/crypto/mod.ts'
import { encodeHex } from 'https://deno.land/std@0.224.0/encoding/hex.ts'

const WS_API_URL = 'https://eneca.worksection.com/api/admin/v2'

interface WsTaskRaw {
  id: string
  name: string
  status: string
  user_to?: { id: string; email: string; name: string }
  max_time?: string
  date_closed?: string
  tags?: Record<string, string>
  child?: WsTaskRaw[]
}

interface SyncStats {
  projects_processed: number
  projects_failed: number
  l2_upserted: number
  l3_upserted: number
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

/** Извлекаем % из тегов задачи (ищем тег вида "10%", "50%" и т.п.) */
function extractPercent(tags?: Record<string, string>): number | null {
  if (!tags) return null
  for (const tagName of Object.values(tags)) {
    const match = tagName.match(/^(\d{1,3})%$/)
    if (match) {
      const val = parseInt(match[1], 10)
      if (val >= 0 && val <= 100) return val
    }
  }
  return null
}

/** Получаем задачи проекта из WS API */
async function fetchWsTasks(wsApiKey: string, projectId: string): Promise<WsTaskRaw[]> {
  const queryParams = `action=get_tasks&id_project=${projectId}&extra=subtasks,tags`
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

  return (json.data ?? []) as WsTaskRaw[]
}

/** Разбираем дерево задач: L1 → L2 → L3 */
function parseTaskTree(
  tasks: WsTaskRaw[],
  projectId: string,
  userMap: Map<string, string>,
  stats: SyncStats,
  now: string
): { l2Rows: Record<string, unknown>[]; l3Rows: Record<string, unknown>[] } {
  const l2Rows: Record<string, unknown>[] = []
  const l3Rows: Record<string, unknown>[] = []

  for (const l1 of tasks) {
    const l2Tasks = l1.child ?? []

    for (const l2 of l2Tasks) {
      const l2Email = l2.user_to?.email?.toLowerCase() ?? null
      const isL2Empty = !l2Email || l2Email === 'noone'

      let l2UserId: string | null = null
      let l2AssigneeEmail: string | null = null

      if (!isL2Empty) {
        l2UserId = userMap.get(l2Email!) ?? null
        if (!l2UserId) {
          stats.user_errors.push(`L2 ${l2.id}: ${l2Email}`)
        }
        l2AssigneeEmail = l2Email
      }

      l2Rows.push({
        ws_task_id: String(l2.id),
        ws_project_id: projectId,
        parent_l1_id: String(l1.id),
        parent_l1_name: l1.name,
        name: l2.name,
        assignee_id: l2UserId,
        assignee_email: l2AssigneeEmail,
        max_time: l2.max_time ? parseFloat(l2.max_time) : null,
        date_closed: l2.date_closed ?? null,
        synced_at: now,
      })

      const l3Tasks = l2.child ?? []
      for (const l3 of l3Tasks) {
        const l3Email = l3.user_to?.email?.toLowerCase() ?? null
        const isL3Empty = !l3Email || l3Email === 'noone'

        let l3UserId: string | null = null
        let l3AssigneeEmail: string | null = null

        if (!isL3Empty) {
          l3UserId = userMap.get(l3Email!) ?? null
          if (!l3UserId) {
            stats.user_errors.push(`L3 ${l3.id}: ${l3Email}`)
          }
          l3AssigneeEmail = l3Email
        }

        l3Rows.push({
          ws_task_id: String(l3.id),
          ws_project_id: projectId,
          parent_l2_id: String(l2.id),
          name: l3.name,
          assignee_id: l3UserId,
          assignee_email: l3AssigneeEmail,
          percent: extractPercent(l3.tags),
          max_time: l3.max_time ? parseFloat(l3.max_time) : null,
          date_closed: l3.date_closed ?? null,
          synced_at: now,
        })
      }
    }
  }

  return { l2Rows, l3Rows }
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

    // 1. Получаем все активные проекты и справочник пользователей
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

    const stats: SyncStats = {
      projects_processed: 0,
      projects_failed: 0,
      l2_upserted: 0,
      l3_upserted: 0,
      api_errors: [],
      user_errors: [],
      db_errors: [],
    }

    const now = new Date().toISOString()
    const projectList = projects ?? []

    // 2. Загружаем задачи из WS API батчами по 5, чтобы не словить rate limit
    const allL2: Record<string, unknown>[] = []
    const allL3: Record<string, unknown>[] = []
    const CONCURRENT = 5

    for (let i = 0; i < projectList.length; i += CONCURRENT) {
      const batch = projectList.slice(i, i + CONCURRENT)
      const wsResults = await Promise.allSettled(
        batch.map((p) => fetchWsTasks(wsApiKey, p.ws_project_id))
      )

      for (let j = 0; j < wsResults.length; j++) {
        const result = wsResults[j]
        const project = batch[j]

        if (result.status === 'rejected') {
          stats.api_errors.push(`${project.ws_project_id} (${project.name}): ${result.reason}`)
          stats.projects_failed++
          continue
        }

        const { l2Rows, l3Rows } = parseTaskTree(
          result.value, project.ws_project_id, userMap, stats, now
        )
        allL2.push(...l2Rows)
        allL3.push(...l3Rows)
        stats.projects_processed++
      }
    }

    if (!dryRun) {
      // 4. Батч-upsert L2 (сначала L2, т.к. L3 ссылается на L2)
      if (allL2.length > 0) {
        const BATCH = 500
        for (let i = 0; i < allL2.length; i += BATCH) {
          const batch = allL2.slice(i, i + BATCH)
          const { error } = await supabase
            .from('ws_tasks_l2')
            .upsert(batch, { onConflict: 'ws_task_id', ignoreDuplicates: false })
          if (error) {
            stats.db_errors.push(`L2 upsert batch ${i}: ${error.message}`)
          } else {
            stats.l2_upserted += batch.length
          }
        }
      }

      // 5. Батч-upsert L3 (checkpoint-поля не передаём — при INSERT используется DB DEFAULT, при UPDATE не затрагиваются)
      if (allL3.length > 0) {
        const BATCH = 500
        for (let i = 0; i < allL3.length; i += BATCH) {
          const batch = allL3.slice(i, i + BATCH)
          const { error } = await supabase
            .from('ws_tasks_l3')
            .upsert(batch, { onConflict: 'ws_task_id', ignoreDuplicates: false })
          if (error) {
            stats.db_errors.push(`L3 upsert batch ${i}: ${error.message}`)
          } else {
            stats.l3_upserted += batch.length
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        dry_run: dryRun,
        stats: {
          projects_total: (projects ?? []).length,
          projects_processed: stats.projects_processed,
          projects_failed: stats.projects_failed,
          l2_total: allL2.length,
          l3_total: allL3.length,
          l2_upserted: stats.l2_upserted,
          l3_upserted: stats.l3_upserted,
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
    console.error('sync-ws-tasks failed:', message)

    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
