'use client'

import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@/modules/cache/keys/query-keys'

import { fetchGratitudeAchievementProgress } from '../actions.client'

import type { GratitudeAchProgress } from '../types'

// refetchOnWindowFocus — страховка на случай обрыва realtime-соединения
// (глобально фокус-рефетч выключен в query-client)

/** Прогресс достижений за благодарности с realtime-обновлением */
export function useGratitudeAchievements(userId: string, initialData: GratitudeAchProgress[]) {
  return useQuery({
    queryKey: queryKeys.achievements.gratitudeProgress(userId),
    queryFn: fetchGratitudeAchievementProgress,
    initialData,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  })
}
