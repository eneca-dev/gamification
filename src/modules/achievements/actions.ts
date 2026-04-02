'use server'

import { getAchievementProgress, getGratitudeAchievementProgress } from './queries'

import type { FullAchievementProgress } from './types'

export async function getUserFullProgress(
  wsUserId: string
): Promise<FullAchievementProgress> {
  const [ranking, gratitude] = await Promise.all([
    getAchievementProgress(wsUserId),
    getGratitudeAchievementProgress(wsUserId),
  ])

  return { ranking, gratitude }
}
