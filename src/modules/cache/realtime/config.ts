import type { QueryKey } from '@tanstack/react-query'

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
export const realtimeSubscriptions: TableSubscription[] = []
