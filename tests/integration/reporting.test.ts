import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { expect, it } from 'vitest'
import { connectQa } from '../helpers/qa-db'
import { transactionMetrics } from '@/modules/admin/export/transaction-metrics'

it.each([false, true])('preserves all reporting metrics except roulette earnings (NULL edge=%s)', async nullEdge => {
  if (process.env.QA_LOCAL_POSTGRES !== 'true') throw new Error('Reporting schema fixture is restricted to the isolated local cluster')
  const db = await connectQa()
  try {
    await db.query('begin')
    const marker = await db.query("select exists(select 1 from qa_guard.environment where project_ref='localroulettefixture' and outbound_reviewed and overrides_approved) as safe")
    expect(marker.rows[0].safe).toBe(true)
    expect((await db.query('select pg_try_advisory_xact_lock(191742090) as acquired')).rows[0].acquired).toBe(true)
    // NULL source is an explicit compatibility case, not valid data in the current production schema.
    if (nullEdge) await db.query('alter table gamification_event_logs alter column source drop not null')
    const ids = [randomUUID(), randomUUID(), randomUUID(), randomUUID()]
    await db.query("insert into admin_department_groups(department,group_type) values('QA Reporting','designer')")
    await db.query("insert into gamification_event_types(key,coins,name) values('qa_reporting',0,'QA Reporting')")
    for (const [i, id] of ids.entries()) {
      await db.query('insert into ws_users(id,ws_user_id,email,first_name,last_name,department,team,is_active) values($1,$2,$3,$4,$5,$6,$7,true)',
        [id, 'qa-reporting-' + id, id + '@example.invalid', 'QA', String(i), 'QA Reporting', i % 2 === 0 ? 'Alpha' : 'Beta'])
      if (i === 0 || i === 2) {
        await db.query('insert into auth.users(id) values($1)', [id])
        await db.query("insert into profiles(user_id,email,created_at) values($1,$2,'2026-10-01')", [id, id + '@example.invalid'])
      }
      await db.query('insert into gamification_balances(user_id,total_coins) values($1,$2)', [id, [521, 380, 75, 0][i]])
    }
    const entries = [
      [0, 100, 'legacy'], [0, -20, 'legacy'], [0, 500, 'roulette'], [0, -100, 'roulette'], [0, 30, nullEdge ? null : 'compat'],
      [1, 200, 'legacy'], [1, -40, 'legacy'], [1, 200, 'roulette'], [1, -50, 'roulette'], [1, 70, nullEdge ? null : 'compat'],
      [2, 100, 'roulette'], [2, -25, 'roulette'],
    ] as const
    for (const [i, coins, source] of [...entries, [0, 11, 'legacy'] as const]) {
      const id = randomUUID()
      const at = coins === 11 ? '2026-11-30T21:00:00Z' : '2026-11-17T09:00:00Z'
      await db.query("insert into gamification_event_logs(id,user_id,user_email,event_type,source,event_date,details,idempotency_key,created_at) values($1,$2,$3,'qa_reporting',$4,'2026-11-17','{}',$5,$6)",
        [id, ids[i], ids[i] + '@example.invalid', source, 'qa-reporting-' + id, at])
      await db.query('insert into gamification_transactions(user_id,user_email,event_id,coins,created_at) values($1,$2,$3,$4,$5)', [ids[i], ids[i] + '@example.invalid', id, coins, at])
    }
    const read = async () => {
      const overview = (await db.query("select get_economy_overview('2026-10-31T21:00:00Z','2026-11-30T21:00:00Z') as value")).rows[0].value
      const core = (await db.query("select get_adoption_period_core_v2('2026-11-01','2026-11-30') as value")).rows[0].value
      const monthly = (await db.query("select get_adoption_monthly_summary_v3('2026-11-01','2026-11-30') as value")).rows[0].value
      const top = (await db.query("select * from get_economy_top('2026-10-31T21:00:00Z','2026-11-30T21:00:00Z','earned','user')")).rows
      return { overview, core, monthly, top }
    }
    const before = await read()
    expect(before.overview.earned).toBe(1200)
    expect(before.monthly.earned_coins).toBe(1200)
    const sql = readFileSync('src/docs-features/roulette/sql/02-reporting.review.sql', 'utf8').replace(/^\uFEFF/, '').replace(/^begin;\r?$/im, '').replace(/^commit;\r?$/im, '')
    await db.query(sql)
    const after = await read()
    expect(after.overview.earned).toBe(400)
    expect(after.overview.factually_earned).toBe(400)
    expect(after.monthly.earned_coins).toBe(400)
    expect(after.monthly.spent_coins).toBe(235)
    expect(after.monthly).toEqual({ ...before.monthly, earned_coins: 400 })
    expect(after.overview).toEqual({ ...before.overview, earned: 400, factually_earned: 400 })
    // Remaining assertions are independent of the implementation's aggregation expression.
    expect(after.core).toEqual({ ...before.core, coverage: { ...before.core.coverage, earned_total: 400, earned_logged: 130, earners: 2 } })
    expect(after.core.coverage.spent_total).toBe(235)
    expect(after.core.coverage.balance_at_to).toBe(965)
    expect(after.top.map(row => Number(row.value))).toEqual([270, 130])
    const tx = await db.query<{ coins: number; source: string | null }>('select t.coins,e.source from gamification_transactions t left join gamification_event_logs e on e.id=t.event_id where t.user_id=any($1::uuid[]) and t.created_at<$2', [ids, '2026-11-30T21:00:00Z'])
    expect(tx.rowCount).toBe(12)
    expect(tx.rows.reduce((sum, row) => sum + row.coins, 0)).toBe(965)
    const metrics = tx.rows.map(row => transactionMetrics(row.coins, row.source))
    expect(metrics.reduce((sum, row) => sum + row.earned, 0)).toBe(400)
    expect(metrics.reduce((sum, row) => sum + row.spent, 0)).toBe(235)
  } finally { await db.query('rollback'); await db.end() }
})

