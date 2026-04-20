/**
 * Query Keys Factory
 *
 * Централизованное управление ключами кеша для TanStack Query.
 * Обеспечивает типобезопасность и предсказуемую инвалидацию.
 *
 * Структура ключей:
 * - all: базовый ключ для всей сущности
 * - lists: все списки сущности
 * - list(filters): конкретный список с фильтрами
 * - details: все детальные запросы
 * - detail(id): конкретная запись
 */

export const queryKeys = {
  balance: {
    all: ['balance'] as const,
    current: () => [...queryKeys.balance.all, 'current'] as const,
  },
  gratitudes: {
    all: ['gratitudes'] as const,
    feed: () => [...queryKeys.gratitudes.all, 'feed'] as const,
    my: (userId: string) => [...queryKeys.gratitudes.all, 'my', userId] as const,
    quota: (userId: string) => [...queryKeys.gratitudes.all, 'quota', userId] as const,
    recipients: () => [...queryKeys.gratitudes.all, 'recipients'] as const,
  },
  orders: {
    all: ['orders'] as const,
    user: (userId: string) => [...queryKeys.orders.all, userId] as const,
  },
  lottery: {
    all: ['lottery'] as const,
    tickets: (userId: string) => [...queryKeys.lottery.all, 'tickets', userId] as const,
  },
} as const

export type QueryKeys = typeof queryKeys
