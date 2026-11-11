import { z } from 'zod'

import type { BimoEquipment } from '@/modules/profile-appearance/index.client'

/** Строка галереи: сотрудник, его действующий образ и лайки за месяц. */
export interface GalleryEntry {
  userId: string
  firstName: string
  lastName: string
  department: string | null
  team: string | null
  equipment: BimoEquipment
  hasLook: boolean
  likes: number
  likedByMe: boolean
}

/** Победитель закрытого месяца. Образ показывается текущий — прошлый не хранится. */
export interface GalleryWinner {
  contestMonth: string
  userId: string
  email: string
  fullName: string
  department: string | null
  likes: number
}

export interface GalleryPage {
  /** Месяц конкурса в формате YYYY-MM по минскому времени. */
  month: string
  likeLimit: number
  usedLikes: number
  entries: GalleryEntry[]
  winners: GalleryWinner[]
  /** asset_key → название вещи из каталога: подписи образа без дублирования текстов. */
  lookLabels: Record<string, string>
}

export interface LikeResult {
  targetId: string
  likes: number
  liked: boolean
  remaining: number
}

export const likeInputSchema = z.object({ targetId: z.string().uuid() })
export type LikeInput = z.infer<typeof likeInputSchema>

export const GALLERY_GROUPINGS = ['dept', 'team', 'none'] as const
export const GALLERY_SORTS = ['likes', 'name'] as const
export const GALLERY_LOOK_FILTERS = ['custom', 'all'] as const

export type GalleryGrouping = typeof GALLERY_GROUPINGS[number]
export type GallerySort = typeof GALLERY_SORTS[number]
export type GalleryLookFilter = typeof GALLERY_LOOK_FILTERS[number]

export interface GalleryView {
  group: GalleryGrouping
  sort: GallerySort
  look: GalleryLookFilter
}

export const DEFAULT_GALLERY_VIEW: GalleryView = { group: 'dept', sort: 'likes', look: 'custom' }
