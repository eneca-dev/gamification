import { test, expect, type Page } from '@playwright/test'

test.beforeEach(async ({ context }) => {
  await context.route('**/*', async route => {
    if (new URL(route.request().url()).origin !== 'http://127.0.0.1:4179') {
      await route.abort()
      throw new Error('Unexpected external request: ' + route.request().url())
    }
    await route.continue()
  })
})

const start = (page: Page) => page.getByRole('button', { name: 'Поставить весь баланс', exact: true })
const currentBalance = (page: Page) => page.getByText('Текущий баланс:')
async function confirm(page: Page) {
  await start(page).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  const bounds = await page.getByRole('dialog').boundingBox()
  expect(bounds).not.toBeNull()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width)
  await page.getByRole('button', { name: 'Подтверждаю ставку' }).click()
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
}

test('layout, seven probabilities, keyboard cancellation and reload', async ({ page }, info) => {
  await page.goto('/')
  await expect(start(page)).toBeEnabled()
  await expect(page.getByRole('list', { name: 'Исходы и вероятности' }).getByRole('listitem')).toHaveCount(7)
  await expect(page.getByText('Вероятность обнуления — 2/7 (28,57%). Вы рискуете всем балансом.')).toBeVisible()
  await noOverflow(page)
  await page.screenshot({ path: info.outputPath('ready.png'), fullPage: true })
  await start(page).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Отмена', exact: true })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Подтверждаю ставку' })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(page.getByRole('button', { name: 'Отмена', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(await page.evaluate(() => window.rouletteQa.fixture.spins)).toEqual([])
  await page.reload()
  await expect(start(page)).toBeEnabled()
})

for (const [scenario, message] of [
  ['disabled', 'Рулетка временно выключена. Сохранённый результат можно восстановить.'],
  ['zero', 'Текущий баланс:'],
  ['impersonating', 'Ходы при подмене пользователя запрещены.'],
  ['loading', 'Обновляем…'],
  ['balance-error', 'Не удалось обновить'],
  ['state-error', 'Не удалось проверить доступность рулетки.'],
] as const) {
  test('safe state: ' + scenario, async ({ page }) => {
    await page.goto('/?scenario=' + scenario)
    await expect(page.getByText(message, { exact: false }).first()).toBeVisible()
    await expect(start(page)).toBeDisabled()
    await noOverflow(page)
  })
}

// Independent acceptance fixtures; do not calculate expected balances with production logic.
for (const [sector, label, after, angle] of [
  ['x2', '×2', '2 000', -25.714286], ['plus500', '+500', '1 500', -77.142857], ['plus200', '+200', '1 200', -128.571429],
  ['plus100', '+100', '1 100', 180], ['plus50', '+50', '1 050', 128.571429], ['zero1', '0', '0', 77.142857], ['zero2', '0', '0', 25.714286],
] as const) {
  test('renders outcome ' + sector, async ({ page }, info) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/?sector=' + sector)
    await confirm(page)
    await expect(page.getByText('Результат за 2026-11: ' + label, { exact: true })).toBeVisible()
    await expect(currentBalance(page)).toHaveText('Текущий баланс: ' + after)
    await expect(start(page)).toHaveCount(0)
    await expect.poll(() => wheelAngle(page)).toBeCloseTo(angle, 3)
    expect(await page.evaluate(() => window.rouletteQa.fixture.spins)).toEqual(['synthetic-only-token'])
    await noOverflow(page)
    if (sector === 'plus500') await page.screenshot({ path: info.outputPath('result.png'), fullPage: true })
  })
}

test('lost reply survives reload; recovery preserves identity and reads current balance', async ({ page }) => {
  await page.goto('/?scenario=lost-response')
  await confirm(page)
  await expect(page.getByRole('button', { name: 'Восстановить результат' })).toBeEnabled()
  const pending = await page.evaluate(() => Object.entries(localStorage).filter(([key]) => key.startsWith('roulette:pending:')))
  expect(pending).toHaveLength(1)
  await page.reload()
  expect(await page.evaluate(() => Object.entries(localStorage).filter(([key]) => key.startsWith('roulette:pending:')))).toEqual(pending)
  await expect(currentBalance(page)).toHaveText('Текущий баланс: 1 537')
  await page.evaluate(() => window.rouletteQa.fixture.setCurrentBalance(1711))
  await page.getByRole('button', { name: 'Восстановить результат' }).click()
  await expect(page.getByText('Результат восстановлен', { exact: true })).toBeVisible()
  await expect(currentBalance(page)).toHaveText('Текущий баланс: 1 711')
  await expect(page.getByText('Баланс сразу после того хода:')).toHaveText('Баланс сразу после того хода: 1 500.')
  expect(await page.evaluate(() => window.rouletteQa.fixture.spins)).toEqual([])
  expect(await page.evaluate(() => window.rouletteQa.fixture.recoveries)).toEqual(['2026-11'])
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('roulette:pending:')))).toEqual([])
})

test('late pre-spin balance cannot overwrite fresh balance', async ({ page }) => {
  await page.goto('/')
  await start(page).click()
  await page.evaluate(() => { window.rouletteQa.fixture.holdNextBalance = true; void window.rouletteQa.refetchBalance() })
  await expect(currentBalance(page)).toContainText('Обновляем…')
  await page.getByRole('button', { name: 'Подтверждаю ставку' }).click()
  await expect(currentBalance(page)).toHaveText('Текущий баланс: 1 500')
  await page.evaluate(() => window.rouletteQa.fixture.releaseBalance())
  await expect.poll(() => page.evaluate(() => window.rouletteQa.fixture.heldReadsCompleted)).toBe(1)
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  await expect(currentBalance(page)).toHaveText('Текущий баланс: 1 500')
  expect(await page.evaluate(() => window.rouletteQa.fixture.spins.length)).toBe(1)
})

test('failed balance refresh does not turn completed spin into failure', async ({ page }) => {
  await page.goto('/?scenario=balance-after-error')
  await confirm(page)
  await expect(page.getByText('Результат за 2026-11: +500', { exact: true })).toBeVisible()
  await expect(currentBalance(page)).toHaveText('Текущий баланс: Не удалось обновить')
  await expect(start(page)).toHaveCount(0)
  await page.evaluate(() => { window.rouletteQa.fixture.failBalance = false })
  await page.getByRole('button', { name: 'Обновить баланс' }).click()
  await expect(currentBalance(page)).toHaveText('Текущий баланс: 1 500')
  expect(await page.evaluate(() => window.rouletteQa.fixture.spins.length)).toBe(1)
})

async function wheelAngle(page: Page) {
  return page.locator('svg[viewBox="0 0 200 200"]').evaluate(element => {
    const matrix = new DOMMatrix(getComputedStyle(element).transform)
    return Math.atan2(matrix.b, matrix.a) * 180 / Math.PI
  })
}

test('animated result and sandbox deny external connections and private files', async ({ page, request }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await confirm(page)
  await expect(page.getByText('Результат за 2026-11: +500', { exact: true })).toBeVisible()
  await expect.poll(() => wheelAngle(page)).toBeCloseTo(-77.142857, 3)
  expect(await page.evaluate(async () => { try { await fetch('https://example.com'); return false } catch { return true } })).toBe(true)
  expect((await request.get('/.env.local')).status()).toBe(404)
  expect((await request.get('/src/modules/roulette/actions.ts')).status()).toBe(404)
  expect(errors).toEqual([])
})
