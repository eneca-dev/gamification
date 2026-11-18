import { expect, it } from 'vitest'
import { resolveStoreTab, storeCategoryUrl } from '@/modules/shop/navigation'
it.each([
  ['catalog', true, true, 'catalog'], ['bimo', true, true, 'bimo'],
  ['bimo', false, true, 'catalog'], ['roulette', true, true, 'roulette'],
  ['roulette', true, false, 'catalog'], ['bad', true, true, 'catalog'],
] as const)('resolves URL %s', (tab, bimo, user, expected) => {
  expect(resolveStoreTab(tab, bimo, user)).toBe(expected)
})
it('serializes category into URL instead of isolated local state', () => {
  expect(storeCategoryUrl('all')).toBe('/store?tab=catalog')
  expect(storeCategoryUrl('a&b')).toBe('/store?tab=catalog&category=a%26b')
})
