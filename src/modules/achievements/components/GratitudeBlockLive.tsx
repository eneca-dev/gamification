'use client'

import { GratitudeBlock } from './AchievementBlock'
import { useGratitudeAchievements } from '../hooks/useGratitudeAchievements'

import type { GratitudeAchProgress } from '../types'

interface GratitudeBlockLiveProps {
  userId: string
  initialItems: GratitudeAchProgress[]
}

/** Обёртка над GratitudeBlock: realtime-обновление прогресса при новой благодарности */
export function GratitudeBlockLive({ userId, initialItems }: GratitudeBlockLiveProps) {
  const { data } = useGratitudeAchievements(userId, initialItems)
  return <GratitudeBlock items={data ?? initialItems} />
}
