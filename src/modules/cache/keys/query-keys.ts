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

export const queryKeys = {} as const

export type QueryKeys = typeof queryKeys
