import { test, expect } from '@playwright/test'
import { confirmationPayloadSchema, spinResultSchema } from '@/modules/roulette/types'

test('lost response after confirmed DB commit recovers the same operation after reload', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1280' || process.env.QA_ENABLE_SPIN_TESTS !== 'true',
    'Requires separately approved isolated fixture user and QA controls')
  const userId = process.env.QA_SPIN_USER_ID
  const serviceKey = process.env.QA_SERVICE_ROLE_KEY
  const expectedAfter = Number(process.env.QA_EXPECTED_BALANCE_AFTER)
  if (!userId || !serviceKey || !Number.isSafeInteger(expectedAfter)) throw new Error('Dedicated QA fixture inputs missing')
  const base = 'https://' + process.env.QA_PROJECT_REF + '.supabase.co/rest/v1'
  const headers = { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey, 'Content-Type': 'application/json' }
  await page.goto('/store?tab=roulette')
  await page.getByRole('button', { name: 'Поставить весь баланс', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  let committed: unknown = null
  let intercepted = false
  await page.route('**/store*', async route => {
    const request = route.request()
    if (intercepted || request.method() !== 'POST' || !request.postData()?.includes('"token"')) {
      await route.continue()
      return
    }
    intercepted = true
    const args = JSON.parse(request.postData()!) as { token: string }[]
    const signedPayload = confirmationPayloadSchema.parse(JSON.parse(Buffer.from(args[0].token.split('.')[0], 'base64url').toString()))
    if (signedPayload.userId !== userId) {
      await route.abort('failed')
      throw new Error('Authenticated QA user does not match the dedicated fixture')
    }
    // fetch waits for the server response; inspect the actual database before dropping it.
    await route.fetch()
    const pending = await page.evaluate(id => {
      const name = Object.keys(localStorage).find(key => key.startsWith('roulette:pending:' + id + ':'))
      return name ? JSON.parse(localStorage.getItem(name)!) as { period: string; operationId: string } : null
    }, userId)
    expect(pending).not.toBeNull()
    const response = await fetch(base + '/rpc/get_roulette_result', {
      method: 'POST', headers, body: JSON.stringify({ p_user_id: userId, p_period: pending!.period }),
    })
    expect(response.ok).toBe(true)
    committed = spinResultSchema.parse(await response.json())
    expect(committed).toMatchObject({ operationId: pending!.operationId, period: pending!.period, balanceAfter: expectedAfter })
    await route.abort('failed')
  })
  await dialog.getByRole('button', { name: 'Подтверждаю ставку' }).click()
  await expect(page.getByRole('button', { name: 'Восстановить результат' })).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Восстановить результат' }).click()
  await expect(page.getByText('Результат восстановлен', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Восстановить результат' })).toHaveCount(0)
  const saved = spinResultSchema.parse(committed)
  const response = await fetch(base + '/rpc/get_roulette_result', {
    method: 'POST', headers, body: JSON.stringify({ p_user_id: userId, p_period: saved.period }),
  })
  expect(await response.json()).toMatchObject(saved)
  const balances = await fetch(base + '/gamification_balances?select=total_coins&user_id=eq.' + userId, { headers })
  expect(await balances.json()).toEqual([{ total_coins: expectedAfter }])
  await expect(page.getByText('Текущий баланс:', { exact: false })).toContainText(expectedAfter.toLocaleString('ru-RU'))
})
