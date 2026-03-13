import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const body = await req.json().catch(() => ({}))
    const dryRun = body.dry_run === true

    // Дата снапшота — сегодня (снапшот делается после синка задач)
    const today = new Date().toISOString().slice(0, 10)

    if (dryRun) {
      const { count, error } = await supabase
        .from('ws_tasks_l3')
        .select('*', { count: 'exact', head: true })
      if (error) throw new Error(`DB error: ${error.message}`)

      return new Response(
        JSON.stringify({ success: true, dry_run: true, snapshot_date: today, tasks_count: count }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Загружаем все L3 с пагинацией
    const rows: { ws_task_id: string; percent: number | null; snapshot_date: string }[] = []
    const PAGE = 1000
    let offset = 0

    while (true) {
      const { data, error: fetchErr } = await supabase
        .from('ws_tasks_l3')
        .select('ws_task_id, percent')
        .range(offset, offset + PAGE - 1)
      if (fetchErr) throw new Error(`DB read error: ${fetchErr.message}`)
      if (!data || data.length === 0) break
      for (const t of data) {
        rows.push({ ws_task_id: t.ws_task_id, percent: t.percent, snapshot_date: today })
      }
      if (data.length < PAGE) break
      offset += PAGE
    }

    // Upsert батчами
    let upserted = 0
    const BATCH = 500
    const dbErrors: string[] = []

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH)
      const { error: upsertErr } = await supabase
        .from('ws_task_percent_snapshots')
        .upsert(batch, { onConflict: 'ws_task_id,snapshot_date', ignoreDuplicates: false })
      if (upsertErr) {
        dbErrors.push(`batch ${i}: ${upsertErr.message}`)
      } else {
        upserted += batch.length
      }
    }

    return new Response(
      JSON.stringify({
        success: dbErrors.length === 0,
        snapshot_date: today,
        tasks_total: rows.length,
        upserted,
        db_errors: dbErrors,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('snapshot-task-percent failed:', message)

    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
