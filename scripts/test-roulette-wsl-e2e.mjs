import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'
import { readRuntime, readApp, connectDatabase, output, appUrl } from './roulette-wsl-app.mjs'

const runtime = readRuntime()
const app = readApp()
if (!app.built) throw new Error('Production build required')
const db = await connectDatabase(runtime)
const pilot = runtime.users.find(user => user.name === 'pilot')
const denied = runtime.users.find(user => user.name === 'denied')
const folder = fs.mkdtempSync(path.join(output, 'acceptance-'))
const report = { startedAt: new Date().toISOString(), backend: runtime.directory, app: app.directory,
  status: 'running', scenarios: [], externalRequests: [], fullE2ePassed: false }
const contexts = []
let browser
fs.writeFileSync(path.join(output, 'acceptance-last.json'), JSON.stringify(report, null, 2))

async function snapshot(user = pilot) {
  const { rows } = await db.query(`select e.id,e.details,t.id as transaction_id,t.coins,b.total_coins as current_balance
    from public.gamification_event_logs e left join public.gamification_transactions t on t.event_id=e.id
    join public.gamification_balances b on b.user_id=e.user_id where e.user_id=$1 and e.source='roulette'`, [user.wsUserId])
  return rows
}
async function balance(user = pilot) {
  return (await db.query('select total_coins from public.gamification_balances where user_id=$1', [user.wsUserId])).rows[0].total_coins
}
function verifyEconomy(rows) {
  assert.equal(rows.length, 1, 'Exactly one result and linked transaction')
  const row = rows[0]
  const after = { x2: 2000, plus500: 1500, plus200: 1200, plus100: 1100, plus50: 1050, zero1: 0, zero2: 0 }[row.details.sector]
  assert.notEqual(after, undefined)
  assert.ok(row.transaction_id)
  assert.equal(row.details.balanceBefore, 1000)
  assert.equal(row.details.balanceAfter, after)
  assert.equal(row.details.delta, after - 1000)
  assert.equal(row.coins, after - 1000)
  return row
}
async function resetFixture() {
  // Only the generated synthetic account in the positively identified owned cluster.
  const unknown = await db.query("select count(*)::int n from gamification_event_logs where user_id=$1 and source not in ('roulette','qa_full_e2e')", [pilot.wsUserId])
  assert.equal(unknown.rows[0].n, 0, 'Unexpected fixture history; refusing reset')
  await db.query('begin')
  try {
    await db.query('update roulette_settings set enabled=false where singleton')
    await db.query("delete from gamification_transactions where user_id=$1 and event_id in (select id from gamification_event_logs where user_id=$1 and source in ('roulette','qa_full_e2e'))", [pilot.wsUserId])
    await db.query("delete from gamification_event_logs where user_id=$1 and source in ('roulette','qa_full_e2e')", [pilot.wsUserId])
    const result = await db.query('update gamification_balances set total_coins=1000,updated_at=now() where user_id=$1', [pilot.wsUserId])
    assert.equal(result.rowCount, 1)
    await db.query('commit')
  } catch (error) { await db.query('rollback'); throw error }
}
async function context(name) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' })
  contexts.push({ ctx, name })
  await ctx.tracing.start({ screenshots: true, snapshots: true })
  await ctx.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.hostname !== '127.0.0.1' || !['3011', '55441'].includes(url.port)) {
      report.externalRequests.push(url.origin + url.pathname)
      await route.abort('blockedbyclient')
    } else await route.continue()
  })
  return ctx
}
async function signIn(ctx, name) {
  const page = await ctx.newPage()
  await page.goto(appUrl + '/login')
  await page.getByRole('button', { name: name === 'pilot' ? 'Войти тестовым игроком' : 'Войти без допуска к рулетке', exact: true }).click()
  await expect(page).toHaveURL(/\/store\?tab=roulette/)
  await expect(page.getByRole('heading', { name: 'Рулетка', exact: true })).toBeVisible()
  return page
}
const bet = page => page.getByRole('button', { name: 'Поставить весь баланс', exact: true })
async function expectBalance(page, expected) {
  await expect.poll(async () => {
    const text = await page.getByText(/^Текущий баланс:/).textContent()
    return Number(text.replace(/\s/g, '').match(/Текущийбаланс:(\d+)/)?.[1])
  }, { timeout: 15000 }).toBe(expected)
}
async function prepare(page) {
  await expect(bet(page)).toBeEnabled({ timeout: 15000 })
  await bet(page).click()
  await expect(page.getByRole('dialog')).toBeVisible()
}
function spinRequest(request) { return request.method() === 'POST' && request.postData()?.includes('"token"') }
function capture(request) {
  const headers = request.headers()
  return { url: request.url(), data: request.postData(), headers: {
    'content-type': headers['content-type'], 'next-action': headers['next-action'], origin: appUrl,
  } }
}
async function replay(ctx, saved) {
  return ctx.request.post(saved.url, { headers: saved.headers, data: saved.data })
}
async function creditAfterCommit() {
  await db.query("insert into gamification_event_types(key,coins,name,is_active,is_dynamic_coins,create_transaction) values('qa_full_e2e_credit',37,'Synthetic recovery credit',true,true,true) on conflict(key) do nothing")
  await db.query("select * from process_gamification_event($1::uuid,$2::text,'qa_full_e2e_credit','qa_full_e2e',(now() at time zone 'Europe/Minsk')::date,'{}'::jsonb,$3::text,37,true)", [pilot.wsUserId, pilot.email, crypto.randomUUID()])
}

try {
  fs.writeFileSync(path.join(folder, 'before-reset.json'), JSON.stringify(await snapshot(), null, 2))
  await resetFixture()
  browser = await chromium.launch({ headless: true })
  const anonymous = await context('anonymous')
  const anonymousPage = await anonymous.newPage()
  await anonymousPage.goto(appUrl + '/store?tab=roulette')
  await expect(anonymousPage).toHaveURL(/\/login$/)
  report.scenarios.push({ name: 'anonymous-rejected', passed: true })

  const normal = await context('normal')
  const page = await signIn(normal, 'pilot')
  await expectBalance(page, 1000)
  await expect(bet(page)).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Рулетка', exact: true })).toBeVisible()
  await db.query('update roulette_settings set enabled=true where singleton')
  await page.reload()
  const deniedContext = await context('denied')
  const deniedPage = await signIn(deniedContext, 'denied')
  await expectBalance(deniedPage, 1000)
  await expect(bet(deniedPage)).toBeDisabled()
  await expect(deniedPage.getByText('Рулетка пока недоступна для этого аккаунта. Сохранённый результат можно восстановить.')).toBeVisible()
  await deniedPage.getByRole('button', { name: 'Все', exact: true }).click()
  await expect(deniedPage.getByText('В этой категории пока нет товаров', { exact: true })).toBeVisible()
  await deniedPage.getByRole('button', { name: 'Рулетка', exact: true }).click()
  await expect(deniedPage.getByText('Рулетка пока недоступна для этого аккаунта. Сохранённый результат можно восстановить.')).toBeVisible()
  await expect(bet(deniedPage)).toBeDisabled()
  await prepare(page)
  const sent = page.waitForRequest(spinRequest)
  await page.getByRole('button', { name: 'Подтверждаю ставку', exact: true }).click()
  const saved = capture(await sent)
  await expect(page.getByText(/^Результат за /)).toBeVisible({ timeout: 15000 })
  const normalRow = verifyEconomy(await snapshot())
  await expectBalance(page, normalRow.details.balanceAfter)
  assert.equal(await balance(), normalRow.details.balanceAfter)
  const withoutSession = await anonymous.request.post(saved.url, { headers: saved.headers, data: saved.data, maxRedirects: 0 })
  if ([303, 307, 308].includes(withoutSession.status())) {
    assert.equal(new URL(withoutSession.headers().location, appUrl).pathname, '/login')
  } else {
    assert.match(await withoutSession.text(), /UNAUTHORIZED/)
  }
  assert.deepEqual(await snapshot(), [normalRow])
  const duplicate = await replay(normal, saved)
  assert.equal(duplicate.status(), 200)
  assert.match(await duplicate.text(), /"replayed":true/)
  assert.deepEqual(await snapshot(), [normalRow])
  await page.reload()
  await expectBalance(page, normalRow.details.balanceAfter)
  await expect(page.getByText(/^Результат за /)).toBeVisible()
  assert.deepEqual(await snapshot(), [normalRow])
  await page.getByRole('button', { name: 'Все', exact: true }).click()
  await expect(page).toHaveURL(/tab=catalog/)
  await expect(page.getByRole('heading', { name: 'Магазин', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Рулетка', exact: true }).click()
  await expectBalance(page, normalRow.details.balanceAfter)
  await expect(page.getByText(/^Результат за /)).toBeVisible()
  assert.deepEqual(await snapshot(), [normalRow])
  const forbidden = await replay(deniedContext, saved)
  assert.match(await forbidden.text(), /ROULETTE_PILOT_DENIED/)
  assert.deepEqual(await snapshot(denied), [])
  await page.screenshot({ path: path.join(folder, 'normal-result.png'), fullPage: true })
  report.scenarios.push({ name: 'verified-login-and-pilot-access', passed: true },
    { name: 'normal-spin-one-result-one-transaction-current-balance', passed: true, row: normalRow },
    { name: 'replay-and-reload-do-not-spin-again', passed: true })
  fs.writeFileSync(path.join(folder, 'normal-snapshot.json'), JSON.stringify(normalRow, null, 2))
  // Isolated dataset reset only AFTER recording and asserting idempotency.
  await normal.tracing.stop({ path: path.join(folder, 'normal-trace.zip') })
  await normal.close()
  await resetFixture()
  await db.query('update roulette_settings set enabled=true where singleton')
  const recoveryContext = await context('recovery')
  const recoveryPage = await signIn(recoveryContext, 'pilot')
  await expectBalance(recoveryPage, 1000)
  await prepare(recoveryPage)
  await db.query('update roulette_settings set enabled=false where singleton')
  await recoveryPage.getByRole('button', { name: 'Подтверждаю ставку', exact: true }).click()
  await expect(recoveryPage.getByText('Рулетка временно выключена', { exact: true })).toBeVisible()
  assert.deepEqual(await snapshot(), [])
  assert.equal(await balance(), 1000)
  report.scenarios.push({ name: 'disabled-after-confirmation-rejects-new-spin', passed: true })
  await db.query('update roulette_settings set enabled=true where singleton')
  await recoveryPage.reload()
  await expectBalance(recoveryPage, 1000)
  await prepare(recoveryPage)
  let lostRow
  let lostRequest
  let routeFailure
  let finishLoss
  const lossCompleted = new Promise(resolve => { finishLoss = resolve })
  await recoveryPage.route('**/store*', async route => {
    if (lostRequest || !spinRequest(route.request())) { await route.continue(); return }
    lostRequest = capture(route.request())
    try {
      const response = await route.fetch()
      assert.equal(response.status(), 200)
      lostRow = verifyEconomy(await snapshot()) // Independent PG connection proves COMMIT before response loss.
      await creditAfterCommit()
      assert.equal(await balance(), lostRow.details.balanceAfter + 37)
    } catch (error) { routeFailure = error }
    try { await route.abort('failed') } finally { finishLoss() }
  })
  await recoveryPage.getByRole('button', { name: 'Подтверждаю ставку', exact: true }).click()
  // Pending UI appears before the request finishes; await the injected response loss itself.
  let lossTimeout
  try {
    await Promise.race([lossCompleted, new Promise((_, reject) => {
      lossTimeout = setTimeout(() => reject(new Error('Committed response-loss interception did not finish')), 30000)
    })])
  } finally { clearTimeout(lossTimeout) }
  await expect(recoveryPage.getByRole('button', { name: 'Восстановить результат', exact: true })).toBeVisible({ timeout: 15000 })
  if (routeFailure) throw routeFailure
  assert.ok(lostRow)
  const pending = await recoveryPage.evaluate(userId => {
    const key = Object.keys(localStorage).find(key => key.startsWith('roulette:pending:' + userId + ':'))
    return key ? JSON.parse(localStorage.getItem(key)) : null
  }, pilot.wsUserId)
  assert.equal(pending.operationId, lostRow.details.operationId)
  assert.equal(pending.period, lostRow.details.period)
  await db.query('update roulette_settings set enabled=false where singleton')
  await recoveryPage.reload()
  await recoveryPage.getByRole('button', { name: 'Восстановить результат', exact: true }).click()
  await expect(recoveryPage.getByText('Результат восстановлен', { exact: true })).toBeVisible()
  await expectBalance(recoveryPage, lostRow.details.balanceAfter + 37)
  await expect(recoveryPage.getByRole('button', { name: 'Восстановить результат', exact: true })).toHaveCount(0)
  const recovered = verifyEconomy(await snapshot())
  assert.equal(recovered.current_balance, lostRow.details.balanceAfter + 37)
  assert.deepEqual(recovered.details, lostRow.details)
  const again = await replay(recoveryContext, lostRequest)
  assert.match(await again.text(), /"replayed":true/)
  assert.deepEqual(await snapshot(), [recovered])
  await recoveryPage.reload()
  await expectBalance(recoveryPage, recovered.current_balance)
  await recoveryPage.screenshot({ path: path.join(folder, 'recovered-result.png'), fullPage: true })
  const serverHtml = await (await recoveryContext.request.get(appUrl + '/store?tab=roulette')).text()
  fs.writeFileSync(path.join(folder, 'recovery-server.html'), serverHtml)
  assert.ok(serverHtml.includes('\\"balance\\":' + recovered.current_balance + ',\\"showDevSwitcher\\":false'), 'Server cache must render the fresh balance after recovery')
  report.scenarios.push({ name: 'committed-response-loss-recovery-and-both-balance-caches', passed: true, row: recovered })
  assert.deepEqual(report.externalRequests, [])
  report.status = 'passed'
  report.fullE2ePassed = true
} catch (error) {
  report.status = 'failed'
  report.error = error.stack || String(error)
  for (const { ctx, name } of contexts) {
    for (const [index, page] of ctx.pages().entries()) {
      await page.screenshot({ path: path.join(folder, name + '-' + index + '-failure.png'), fullPage: true }).catch(() => {})
    }
  }
  process.exitCode = 1
} finally {
  const cleanup = async (label, effect) => {
    try { await effect() } catch (error) {
      report.status = 'failed'
      report.fullE2ePassed = false
      process.exitCode = 1
      ;(report.cleanupErrors ??= []).push(label + ': ' + error.message)
    }
  }
  await cleanup('disable-and-verify', async () => {
    await db.query('update roulette_settings set enabled=false where singleton')
    report.finalLocalEnabled = (await db.query('select enabled from roulette_settings where singleton')).rows[0].enabled
    assert.equal(report.finalLocalEnabled, false)
  })
  for (const { ctx, name } of contexts) {
    await ctx.tracing.stop({ path: path.join(folder, name + '-trace.zip') }).catch(() => {})
    await cleanup('context-' + name, () => ctx.close())
  }
  await cleanup('browser', async () => { await browser?.close() })
  await cleanup('database', () => db.end())
  report.finishedAt = new Date().toISOString()
  fs.writeFileSync(path.join(folder, 'result.json'), JSON.stringify(report, null, 2))
  fs.writeFileSync(path.join(output, 'acceptance-last.json'), JSON.stringify(report, null, 2))
  console.log('Acceptance: ' + report.status + '; ' + report.scenarios.length + ' checks; artifacts=' + folder)
  if (report.error) console.error(report.error)
}
