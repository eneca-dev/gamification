import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import type { Client } from 'pg'
import { connectQa as connect } from '../helpers/qa-db'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { spinResponseSchema } from '@/modules/roulette/types'

let db: Client
let first: Client
let second: Client
let firstPid: number
let secondPid: number
const users: string[] = []
const eventType = 'qa_roulette_award_' + randomUUID().replaceAll('-', '')
let original: { enabled: boolean; fixed_time: Date; fixed_sector: number; fault_stage: string | null } | undefined
let approved = false

async function fixture() {
  const id = randomUUID()
  users.push(id)
  await db.query('insert into public.ws_users(id,ws_user_id,email,first_name,last_name) values($1,$2,$3,$4,$5)',
    [id, 'qa-roulette-' + id, id + '@roulette.example.invalid', 'QA', 'Roulette'])
  await db.query('insert into public.gamification_balances(user_id,total_coins) values($1,1000)', [id])
  return id
}
async function spin(client: Client, user: string, expected = 1000, period = '2026-11', operation = randomUUID()) {
  const response = await client.query<{ value: unknown }>(
    'select public.spin_roulette($1,$2,$3,$4) as value', [user, period, operation, expected])
  return spinResponseSchema.parse(response.rows[0].value)
}
async function balance(user: string) {
  return (await db.query<{ total_coins: number }>('select total_coins from public.gamification_balances where user_id=$1', [user])).rows[0].total_coins
}
async function rouletteEvents(user: string) {
  return (await db.query<{ count: number }>("select count(*)::integer as count from public.gamification_event_logs where user_id=$1 and source='roulette'", [user])).rows[0].count
}
async function waitForLock(pid: number) {
  const deadline = Date.now() + 10000
  while (Date.now() < deadline) {
    const row = await db.query<{ waiting: boolean }>("select wait_event_type='Lock' as waiting from pg_stat_activity where pid=$1", [pid])
    if (row.rows[0]?.waiting) return
    await delay(20)
  }
  throw new Error('Expected an actual database lock wait; the race was not exercised')
}
function settled<T>(promise: Promise<T>) {
  return promise.then(value => ({ value, error: null }), (error: Error) => ({ value: null, error }))
}
async function otherOperation(client: Client, user: string, operation: 'purchase' | 'award') {
  if (operation === 'purchase') {
    const response = await client.query<{ value: { coins_spent: number } }>(
      'select public.purchase_product($1::uuid,$2::uuid,$3::text) as value',
      [process.env.QA_PRODUCT_ID, user, 'Isolated roulette QA'])
    expect(response.rows[0].value.coins_spent).toBe(100)
  } else {
    await client.query(
      'select public.process_gamification_event($1::uuid,$2::text,$3::text,$4::text,$5::date,$6::jsonb,$7::text,$8::integer,$9::boolean)',
      [user, user + '@roulette.example.invalid', eventType, 'qa', '2026-11-17', '{}', randomUUID(), 100, true])
  }
}

beforeAll(async () => {
  db = await connect()
  const marker = await db.query<{ safe: boolean }>(
    'select exists(select 1 from qa_guard.environment where project_ref=$1 and outbound_reviewed and overrides_approved) as safe',
    [process.env.QA_PROJECT_REF])
  if (!marker.rows[0].safe) throw new Error('QA guard does not authorize this project')
  // Serializes cooperating suites, not production operations.
  const lock = await db.query<{ acquired: boolean }>('select pg_try_advisory_lock(191742090) as acquired')
  if (!lock.rows[0].acquired) throw new Error('Another roulette QA suite is active')
  const signatures = await db.query<{ available: boolean }>(
    "select to_regprocedure('public.process_gamification_event(uuid,text,text,text,date,jsonb,text,integer,boolean)') is not null and to_regprocedure('public.purchase_product(uuid,uuid,text)') is not null as available")
  if (!signatures.rows[0].available) throw new Error('QA baseline differs: required RPC signatures missing')
  const state = await db.query<{ enabled: boolean; fixed_time: Date; fixed_sector: number; fault_stage: string | null }>(
    'select s.enabled,c.fixed_time,c.fixed_sector,c.fault_stage from public.roulette_settings s cross join roulette_qa.control c where s.singleton and c.singleton')
  if (state.rows.length !== 1) throw new Error('Approved QA controls must be installed')
  original = state.rows[0]
  const product = await db.query<{ price: number; safe: boolean }>(
    "select greatest(1,round(p.cost_byn*p.coefficient*public.current_crystal_rate())::integer+p.price_adjustment_crystals) as price, p.is_active and c.is_active and not c.is_countable and not c.is_physical and p.effect is null as safe from public.shop_products p join public.shop_categories c on c.id=p.category_id where p.id=$1",
    [process.env.QA_PRODUCT_ID])
  if (product.rows[0]?.price !== 100 || product.rows[0]?.safe !== true) {
    throw new Error('Dedicated active digital, non-stock QA product must cost exactly 100')
  }
  approved = true
  await db.query('insert into public.gamification_event_types(key,coins,name,is_active,is_dynamic_coins,create_transaction) values($1,100,$2,true,true,true)', [eventType, 'QA roulette award'])
  first = await connect()
  second = await connect()
  firstPid = (await first.query<{ pid: number }>('select pg_backend_pid() as pid')).rows[0].pid
  secondPid = (await second.query<{ pid: number }>('select pg_backend_pid() as pid')).rows[0].pid
})
beforeEach(async () => {
  await db.query("update roulette_qa.control set fixed_time='2026-11-17 12:00:00+03',fixed_sector=0,fault_stage=null where singleton")
  await db.query('update public.roulette_settings set enabled=true where singleton')
})
afterEach(async () => {
  await Promise.all([first?.query('rollback'), second?.query('rollback')])
})
afterAll(async () => {
  // Release actors before owner cleanup, including failed lock-wait assertions.
  await Promise.allSettled([first?.end(), second?.end()])
  if (!db) return
  try {
    if (approved) {
      await db.query('begin')
      await db.query('update roulette_qa.control set fault_stage=null where singleton')
      await db.query('delete from public.shop_orders where user_id=any($1::uuid[])', [users])
      await db.query('delete from public.gamification_transactions where user_id=any($1::uuid[])', [users])
      await db.query('delete from public.gamification_event_logs where user_id=any($1::uuid[])', [users])
      await db.query('delete from public.gamification_balances where user_id=any($1::uuid[])', [users])
      await db.query('delete from public.ws_users where id=any($1::uuid[])', [users])
      await db.query('delete from public.gamification_event_types where key=$1', [eventType])
      if (original) {
        await db.query('update public.roulette_settings set enabled=$1 where singleton', [original.enabled])
        await db.query('update roulette_qa.control set fixed_time=$1,fixed_sector=$2,fault_stage=$3 where singleton',
          [original.fixed_time, original.fixed_sector, original.fault_stage])
      }
      await db.query('commit')
    }
  } finally { await db.end() }
})

it('two requests waiting before commit return one canonical result and one ledger entry', async () => {
  const user = await fixture()
  await first.query('begin')
  const winner = await spin(first, user)
  const loser = settled(spin(second, user))
  await waitForLock(secondPid)
  await first.query('commit')
  const replay = await loser
  expect(replay.error).toBeNull()
  expect(replay.value).toEqual({ result: winner.result, replayed: true })
  expect(await balance(user)).toBe(2000)
  expect(await rouletteEvents(user)).toBe(1)
  const ledger = await db.query<{ coins: number }>('select coins from public.gamification_transactions where user_id=$1', [user])
  expect(ledger.rows).toEqual([{ coins: 1000 }])
})

describe.each(['purchase', 'award'] as const)('race with actual %s RPC', operation => {
  it('spin commits first; the other operation preserves its balance change', async () => {
    const user = await fixture()
    await first.query('begin')
    await spin(first, user)
    const following = settled(otherOperation(second, user, operation))
    await waitForLock(secondPid)
    await first.query('commit')
    expect((await following).error).toBeNull()
    expect(await balance(user)).toBe(operation === 'purchase' ? 1900 : 2100)
    expect(await rouletteEvents(user)).toBe(1)
  })
  it('the other operation commits first; stale confirmation is rejected, then a new confirmation succeeds', async () => {
    const user = await fixture()
    await first.query('begin')
    await otherOperation(first, user, operation)
    const following = settled(spin(second, user))
    await waitForLock(secondPid)
    await first.query('commit')
    expect((await following).error?.message).toBe('roulette_balance_changed')
    expect(await rouletteEvents(user)).toBe(0)
    expect(await balance(user)).toBe(operation === 'purchase' ? 900 : 1100)
    await spin(second, user, operation === 'purchase' ? 900 : 1100)
    expect(await balance(user)).toBe(operation === 'purchase' ? 1800 : 2200)
  })
})

it('rechecks Minsk period after waiting for balance lock', async () => {
  const user = await fixture()
  await first.query('begin')
  await first.query('select total_coins from public.gamification_balances where user_id=$1 for update', [user])
  const waiting = settled(spin(second, user))
  await waitForLock(secondPid)
  await db.query("update roulette_qa.control set fixed_time='2026-12-01 00:00:01+03' where singleton")
  await first.query('commit')
  expect((await waiting).error?.message).toBe('roulette_period_changed')
  expect(await rouletteEvents(user)).toBe(0)
  expect(await balance(user)).toBe(1000)
})

it('a passed switch check may finish after disable; new spins fail and replay works', async () => {
  const user = await fixture()
  await db.query('select pg_advisory_lock(191742091)')
  const waiting = settled(spin(first, user))
  try {
    await waitForLock(firstPid)
    await db.query('update public.roulette_settings set enabled=false where singleton')
  } finally { await db.query('select pg_advisory_unlock(191742091)') }
  const completed = await waiting
  expect(completed.error).toBeNull()
  expect((await spin(second, user)).result).toEqual(completed.value?.result)
  await expect(spin(second, await fixture())).rejects.toThrow('roulette_disabled')
})

it.each(['event', 'transaction', 'balance'])('rolls back every financial write after injected %s failure', async stage => {
  const user = await fixture()
  await db.query('update roulette_qa.control set fault_stage=$1 where singleton', [stage])
  await expect(spin(first, user)).rejects.toThrow('qa_injected_' + stage)
  expect(await rouletteEvents(user)).toBe(0)
  expect(await balance(user)).toBe(1000)
  const ledger = await db.query<{ count: number }>('select count(*)::integer as count from public.gamification_transactions where user_id=$1', [user])
  expect(ledger.rows[0].count).toBe(0)
})

it('denies public/client roles every roulette RPC and direct settings writes', async () => {
  for (const role of ['anon', 'authenticated']) {
    const permissions = await db.query<{ allowed: boolean }>(
      "select has_function_privilege($1,'public.spin_roulette(uuid,text,uuid,integer)','EXECUTE') or has_function_privilege($1,'public.get_roulette_result(uuid,text)','EXECUTE') or has_function_privilege($1,'public.get_roulette_state(uuid)','EXECUTE') or has_function_privilege($1,'public.get_roulette_stats(timestamptz,timestamptz)','EXECUTE') or has_table_privilege($1,'public.roulette_settings','UPDATE') as allowed", [role])
    expect(permissions.rows[0].allowed).toBe(false)
  }
})
it('rejects zero balance without consuming the monthly operation', async () => {
  const user = await fixture()
  await db.query('update gamification_balances set total_coins=0 where user_id=$1', [user])
  await expect(spin(first, user)).rejects.toThrow('roulette_no_balance')
  expect(await rouletteEvents(user)).toBe(0)
  expect(await balance(user)).toBe(0)
})
it('checks the numeric limit before RNG even when the fixed outcome would be zero', async () => {
  const user = await fixture()
  await db.query('update gamification_balances set total_coins=1073741824 where user_id=$1', [user])
  await db.query('update roulette_qa.control set fixed_sector=5 where singleton')
  await expect(spin(first, user, 1073741824)).rejects.toThrow('roulette_numeric_limit')
  expect(await rouletteEvents(user)).toBe(0)
  expect(await balance(user)).toBe(1073741824)
})

