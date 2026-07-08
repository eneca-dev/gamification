'use server'

import { getCurrentUser } from '@/modules/auth/queries'

import { getGratitudeAchievementProgressFresh } from './queries'

import type { GratitudeAchProgress } from './types'

/**
 * Свежий прогресс достижений за благодарности текущего пользователя (для TanStack Query).
 * Обходит 5-мин кэш; пользователь берётся из сессии — чужой прогресс запросить нельзя.
 */
export async function fetchGratitudeAchievementProgress(): Promise<GratitudeAchProgress[]> {
  const user = await getCurrentUser()
  if (!user?.wsUserId) return []
  return getGratitudeAchievementProgressFresh(user.wsUserId)
}
