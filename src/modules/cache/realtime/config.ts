import type { QueryKey } from '@tanstack/react-query'

import { queryKeys } from '../keys/query-keys'

export interface TableSubscription {
  table: string
  invalidateKeys: QueryKey[]
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
}

/**
 * Конфигурация realtime подписок на таблицы Supabase.
 *
 * При добавлении новой таблицы:
 * 1. Добавить запись в этот массив
 * 2. Включить таблицу в Supabase publication:
 *    ALTER PUBLICATION supabase_realtime ADD TABLE table_name;
 *
 * Пример:
 *   {
 *     table: 'achievements',
 *     invalidateKeys: [queryKeys.achievements.all],
 *   },
 */
export const realtimeSubscriptions: TableSubscription[] = [
  // Благодарности: новая запись → обновить ленты/квоту у всех, баланс (подарки)
  // и прогресс достижений за благодарности у получателя
  {
    table: 'gratitudes',
    invalidateKeys: [queryKeys.gratitudes.all, queryKeys.balance.all, queryKeys.achievements.all],
    event: 'INSERT',
  },
  // Транзакции: RLS отдаёт только свои строки → событие приходит только владельцу
  {
    table: 'gamification_transactions',
    invalidateKeys: [queryKeys.transactions.all, queryKeys.balance.all],
    event: 'INSERT',
  },
]
