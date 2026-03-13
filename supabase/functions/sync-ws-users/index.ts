import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { crypto } from 'https://deno.land/std@0.224.0/crypto/mod.ts'
import { encodeHex } from 'https://deno.land/std@0.224.0/encoding/hex.ts'

const WS_API_URL = 'https://eneca.worksection.com/api/admin/v2'

interface WsUser {
  id: string
  email: string
  first_name: string
  last_name: string
  name: string
  department: string | null
  group: string | null
  role: string
  title: string | null
}

interface DbUser {
  id: string
  ws_user_id: string
  email: string
  first_name: string
  last_name: string
  department: string | null
  team: string | null
  is_active: boolean
  synced_at: string
}

interface SyncStats {
  inserted: number
  updated: number
  deactivated: number
  reactivated: number
  skipped: number
}

/** Вычисляем MD5-хеш для WS Admin API (hash = MD5(query_params + api_key)) */
async function md5(input: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('MD5', data)
  return encodeHex(new Uint8Array(hashBuffer))
}

/** Получаем список пользователей из Worksection API */
async function fetchWsUsers(wsApiKey: string): Promise<WsUser[]> {
  const queryParams = 'action=get_users'
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

  return json.data as WsUser[]
}

/** Убираем служебные символы (Ⓓ и т.п.) из строки */
function cleanLabel(value: string | null): string | null {
  if (!value) return null
  return value.replace(/[\u24B6-\u24E9\u2460-\u24FF]/g, '').trim()
}

/** Проверяем, изменились ли данные пользователя */
function hasChanges(wsUser: WsUser, dbUser: DbUser): boolean {
  return (
    wsUser.email !== dbUser.email ||
    wsUser.first_name !== dbUser.first_name ||
    wsUser.last_name !== dbUser.last_name ||
    cleanLabel(wsUser.group ?? null) !== dbUser.department ||
    (wsUser.department ?? null) !== dbUser.team
  )
}

Deno.serve(async (req) => {
  try {
    // Проверяем метод
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

    // Env-переменные
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const wsApiKey = Deno.env.get('WORKSECTION_ADMIN_API_KEY')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 1. Получаем данные из обоих источников параллельно
    const [wsUsers, { data: dbUsers, error: dbError }] = await Promise.all([
      fetchWsUsers(wsApiKey),
      supabase.from('ws_users').select('*'),
    ])

    if (dbError) {
      throw new Error(`DB read error: ${dbError.message}`)
    }

    // 2. Строим карты для быстрого поиска
    const wsMap = new Map<string, WsUser>()
    for (const user of wsUsers) {
      wsMap.set(String(user.id), user)
    }

    const dbMap = new Map<string, DbUser>()
    for (const user of (dbUsers as DbUser[])) {
      dbMap.set(user.ws_user_id, user)
    }

    const stats: SyncStats = {
      inserted: 0,
      updated: 0,
      deactivated: 0,
      reactivated: 0,
      skipped: 0,
    }

    const now = new Date().toISOString()

    // 3. Обрабатываем пользователей из WS
    for (const [wsId, wsUser] of wsMap) {
      const dbUser = dbMap.get(wsId)

      if (!dbUser) {
        // Новый пользователь → INSERT
        const { error } = await supabase.from('ws_users').insert({
          ws_user_id: wsId,
          email: wsUser.email,
          first_name: wsUser.first_name,
          last_name: wsUser.last_name,
          department: cleanLabel(wsUser.group ?? null),
          team: wsUser.department ?? null,
          is_active: true,
          synced_at: now,
        })

        if (error) {
          console.error(`INSERT error for ws_user_id=${wsId}:`, error.message)
          continue
        }

        stats.inserted++
      } else if (!dbUser.is_active) {
        // Реактивация — пользователь вернулся в ответ WS
        const { error } = await supabase
          .from('ws_users')
          .update({
            email: wsUser.email,
            first_name: wsUser.first_name,
            last_name: wsUser.last_name,
            department: cleanLabel(wsUser.group ?? null),
            team: wsUser.department ?? null,
            is_active: true,
            synced_at: now,
          })
          .eq('ws_user_id', wsId)

        if (error) {
          console.error(`REACTIVATE error for ws_user_id=${wsId}:`, error.message)
          continue
        }

        stats.reactivated++
      } else if (hasChanges(wsUser, dbUser)) {
        // Данные изменились → UPDATE
        const { error } = await supabase
          .from('ws_users')
          .update({
            email: wsUser.email,
            first_name: wsUser.first_name,
            last_name: wsUser.last_name,
            department: cleanLabel(wsUser.group ?? null),
            team: wsUser.department ?? null,
            synced_at: now,
          })
          .eq('ws_user_id', wsId)

        if (error) {
          console.error(`UPDATE error for ws_user_id=${wsId}:`, error.message)
          continue
        }

        stats.updated++
      } else {
        // Без изменений → пропускаем
        stats.skipped++
      }
    }

    // 4. Деактивируем пользователей, которых нет в ответе WS
    for (const [wsId, dbUser] of dbMap) {
      if (!wsMap.has(wsId) && dbUser.is_active) {
        const { error } = await supabase
          .from('ws_users')
          .update({ is_active: false, synced_at: now })
          .eq('ws_user_id', wsId)

        if (error) {
          console.error(`DEACTIVATE error for ws_user_id=${wsId}:`, error.message)
          continue
        }

        stats.deactivated++
      }
    }

    return new Response(JSON.stringify({ success: true, stats }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('sync-ws-users failed:', message)

    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
