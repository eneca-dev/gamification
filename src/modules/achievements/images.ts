import type { AchievementEntityType } from './types'

export type AchievementImageName =
  | 'revit-user' | 'revit-team' | 'revit-department'
  | 'ws-user' | 'ws-team' | 'ws-department'
  | 'gratitude-help' | 'gratitude-quality' | 'gratitude-mentoring'

const IMAGE_FOLDER = 'achievements/v2'

const IMAGE_FILES: Record<AchievementImageName, string> = {
  'revit-user': 'revit-user-wink',
  'revit-team': 'revit-team-green-puzzle',
  'revit-department': 'revit-department-inspired',
  'ws-user': 'ws-user-focused',
  'ws-team': 'ws-team-thoughtful',
  'ws-department': 'ws-department-celebrating',
  'gratitude-help': 'gratitude-help',
  'gratitude-quality': 'gratitude-quality-surprised',
  'gratitude-mentoring': 'gratitude-mentoring-teacher',
}

export function achievementImageUrl(name: AchievementImageName): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
  const fileName = IMAGE_FILES[name]
  return base
    ? `${base}/storage/v1/object/public/product-images/${IMAGE_FOLDER}/${fileName}.webp`
    : `/${IMAGE_FOLDER}/${fileName}.webp`
}

export function rankingImageName(area: 'revit' | 'ws', entityType: AchievementEntityType): AchievementImageName {
  return `${area}-${entityType}`
}

export function gratitudeImageName(category: string): AchievementImageName {
  if (category === 'quality') return 'gratitude-quality'
  if (category === 'mentoring') return 'gratitude-mentoring'
  return 'gratitude-help'
}

export function awardImageName(area: string, entityType: AchievementEntityType): AchievementImageName {
  if (area === 'revit' || area === 'ws') return rankingImageName(area, entityType)
  return gratitudeImageName(area.replace(/^gratitude_/, ''))
}
