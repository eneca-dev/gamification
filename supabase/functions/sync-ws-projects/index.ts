import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { crypto } from 'https://deno.land/std@0.224.0/crypto/mod.ts'
import { encodeHex } from 'https://deno.land/std@0.224.0/encoding/hex.ts'

const WS_API_URL = 'https://eneca.worksection.com/api/admin/v2'

// ID меток для фильтрации проектов
const SYNC_TAG_IDS = ['230964', '231042'] // eneca.work sync, eneca.work sync OS

interface WsProject {
  id: string
  name: string
  status: string
  page: string
  tags?: Record<string, string>
}

interface DbProject {
  id: string
  ws_project_id: string
  name: string
  status: string
  tag: string | null
  synced_at: string
}

interface SyncStats {
  inserted: number
  updated: number
  archived: number
  skipped: number
}

/** Вычисляем MD5-хеш для WS Admin API (hash = MD5(query_params + api_key)) */
async function md5(input: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('MD5', data)
  return encodeHex(new Uint8Array(hashBuffer))
}

/** Находим метку синка у проекта (возвращает название метки или null) */
function getSyncTag(project: WsProject): string | null {
  if (!project.tags) return null
  for (const tagId of SYNC_TAG_IDS) {
    if (tagId in project.tags) return project.tags[tagId]
  }
  return null
}

/** Получаем список активных проектов с метками синка из Worksection API */
async function fetchWsProjects(wsApiKey: string): Promise<WsProject[]> {
  const queryParams = 'action=get_projects&filter=active&extra=tags'
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

  const allProjects = json.data as WsProject[]
  return allProjects.filter((p) => getSyncTag(p) !== null)
}

/** Проверяем, изменились ли данные проекта */
function hasChanges(wsProject: WsProject, dbProject: DbProject): boolean {
  return wsProject.name !== dbProject.name || getSyncTag(wsProject) !== dbProject.tag
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Проверяем авторизацию через SYNC_SECRET
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

    // 1. Получаем данные из обоих источников параллельно
    const [wsProjects, { data: dbProjects, error: dbError }] = await Promise.all([
      fetchWsProjects(wsApiKey),
      supabase.from('ws_projects').select('*'),
    ])

    if (dbError) {
      throw new Error(`DB read error: ${dbError.message}`)
    }

    // 2. Строим карты для быстрого поиска
    const wsMap = new Map<string, WsProject>()
    for (const project of wsProjects) {
      wsMap.set(String(project.id), project)
    }

    const dbMap = new Map<string, DbProject>()
    for (const project of (dbProjects as DbProject[])) {
      dbMap.set(project.ws_project_id, project)
    }

    const stats: SyncStats = {
      inserted: 0,
      updated: 0,
      archived: 0,
      skipped: 0,
    }

    const now = new Date().toISOString()

    // 3. Обрабатываем проекты из WS
    for (const [wsId, wsProject] of wsMap) {
      const dbProject = dbMap.get(wsId)

      if (!dbProject) {
        // Новый проект → INSERT
        const { error } = await supabase.from('ws_projects').insert({
          ws_project_id: wsId,
          name: wsProject.name,
          tag: getSyncTag(wsProject),
          status: 'active',
          synced_at: now,
        })

        if (error) {
          console.error(`INSERT error for ws_project_id=${wsId}:`, error.message)
          continue
        }

        stats.inserted++
      } else if (dbProject.status === 'archived') {
        // Реактивация — проект снова активен
        const { error } = await supabase
          .from('ws_projects')
          .update({ name: wsProject.name, tag: getSyncTag(wsProject), status: 'active', synced_at: now })
          .eq('ws_project_id', wsId)

        if (error) {
          console.error(`REACTIVATE error for ws_project_id=${wsId}:`, error.message)
          continue
        }

        stats.updated++
      } else if (hasChanges(wsProject, dbProject)) {
        // Название изменилось → UPDATE
        const { error } = await supabase
          .from('ws_projects')
          .update({ name: wsProject.name, tag: getSyncTag(wsProject), synced_at: now })
          .eq('ws_project_id', wsId)

        if (error) {
          console.error(`UPDATE error for ws_project_id=${wsId}:`, error.message)
          continue
        }

        stats.updated++
      } else {
        stats.skipped++
      }
    }

    // 4. Архивируем проекты, которых нет в ответе WS
    for (const [wsId, dbProject] of dbMap) {
      if (!wsMap.has(wsId) && dbProject.status === 'active') {
        const { error } = await supabase
          .from('ws_projects')
          .update({ status: 'archived', synced_at: now })
          .eq('ws_project_id', wsId)

        if (error) {
          console.error(`ARCHIVE error for ws_project_id=${wsId}:`, error.message)
          continue
        }

        stats.archived++
      }
    }

    return new Response(JSON.stringify({ success: true, stats }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('sync-ws-projects failed:', message)

    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
