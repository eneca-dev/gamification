import { expect, it } from 'vitest'
import { canUseRoulette } from '@/config/roulette'

// Пилотный доступ по адресу почты снят: рулетку включает переключатель админки.
// Остаётся запрет хода из-под подмены пользователя — иначе администратор
// прокрутил бы чужой баланс.
it('allows a signed-in employee', () => {
  expect(canUseRoulette({ isImpersonating: false })).toBe(true)
  expect(canUseRoulette({})).toBe(true)
})

it('fails closed while impersonating or without a user', () => {
  expect(canUseRoulette({ isImpersonating: true })).toBe(false)
  expect(canUseRoulette(null)).toBe(false)
})
