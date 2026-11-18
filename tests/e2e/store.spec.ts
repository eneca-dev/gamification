import { test, expect } from '@playwright/test'

test('direct roulette URL, reload, catalog and history preserve selected view', async ({ page }) => {
  await page.goto('/store?tab=roulette')
  await expect(page.getByRole('heading', { name: 'Рулетка', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Рулетка', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Все', exact: true }).click()
  await expect(page).toHaveURL(/tab=catalog/)
  const category = page.locator('[data-onboarding-category]').first()
  if (await category.count()) {
    const slug = await category.getAttribute('data-onboarding-category')
    await category.click()
    await expect.poll(() => new URL(page.url()).searchParams.get('category')).toBe(slug)
    await page.goBack()
    await expect.poll(() => new URL(page.url()).searchParams.get('category')).toBeNull()
    await page.goForward()
    await expect.poll(() => new URL(page.url()).searchParams.get('category')).toBe(slug)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('roulette lists all seven probabilities and explicit total-balance risk', async ({ page }) => {
  await page.goto('/store?tab=roulette')
  await expect(page.getByRole('list', { name: 'Исходы и вероятности' }).getByRole('listitem')).toHaveCount(7)
  await expect(page.getByText('Вероятность обнуления — 2/7 (28,57%). Вы рискуете всем балансом.')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
