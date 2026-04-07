'use server'

import { getCurrentUser } from '@/modules/auth/queries'

import { getAchievementProgress, getGratitudeAchievementProgress } from './queries'

import type { FullAchievementProgress } from './types'

const EMPTY_PROGRESS: FullAchievementProgress = { ranking: null, gratitude: [] }

export async function getUserFullProgress(
  wsUserId: string
): Promise<FullAchievementProgress> {
  const user = await getCurrentUser()
  if (!user?.wsUserId || user.wsUserId !== wsUserId) return EMPTY_PROGRESS

  const [ranking, gratitude] = await Promise.all([
    getAchievementProgress(wsUserId),
    getGratitudeAchievementProgress(wsUserId),
  ])

  return { ranking, gratitude }
}
