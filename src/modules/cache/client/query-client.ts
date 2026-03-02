import { QueryClient } from '@tanstack/react-query'

export const staleTimePresets = {
  static: 10 * 60 * 1000,   // 10 мин — справочники (редко меняются)
  slow: 5 * 60 * 1000,      // 5 мин — профили, настройки
  medium: 3 * 60 * 1000,    // 3 мин — основные данные (по умолчанию)
  fast: 2 * 60 * 1000,      // 2 мин — часто обновляемые данные
  realtime: 1 * 60 * 1000,  // 1 мин — почти realtime данные
  none: 0,                   // 0 — без кэширования (уведомления)
} as const

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: staleTimePresets.medium,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  })
}
