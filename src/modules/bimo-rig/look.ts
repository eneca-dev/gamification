// Экипировка и её превращение в образ. Живёт в движке, потому что это нужно
// всем потребителям рендера: магазину, галерее и админским превью.

import { CLASSIC_GARMENT, DEFAULT_LOOK } from './rig'
import type { BimoArt, BimoLook } from './types'

export const BIMO_SLOTS = ['outfit', 'accessory', 'background'] as const
export type BimoSlot = typeof BIMO_SLOTS[number]

/** Что надето: по одной вещи на раздел, null — базовый вариант раздела. */
export type BimoEquipment = Record<BimoSlot, string | null>

/** asset_key → слои графики из каталога. */
export type BimoArtMap = Record<string, BimoArt>

export const DEFAULT_EQUIPMENT: BimoEquipment = { outfit: null, accessory: null, background: null }

/** Вещь можно показать: её графика разобрана парсером каталога. */
export function bimoRenderable(assetKey: string, art?: BimoArtMap | null): boolean {
  return Boolean(art?.[assetKey])
}

export function bimoLook(equipment: BimoEquipment, art?: BimoArtMap | null): BimoLook {
  const outfit = equipment.outfit ? art?.[equipment.outfit] : null
  const accessory = equipment.accessory ? art?.[equipment.accessory] : null
  const background = equipment.background ? art?.[equipment.background] : null
  return {
    garment: outfit?.outfit ? outfit : CLASSIC_GARMENT,
    accessory: accessory?.head || accessory?.neck ? accessory : null,
    backgroundSrc: background?.image ?? DEFAULT_LOOK.backgroundSrc,
  }
}
