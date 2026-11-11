import type { BimoAccessory, BimoBackground, BimoOutfit } from './scenes'

export const BIMO_SLOTS = ['outfit', 'accessory', 'background'] as const
export type BimoSlot = typeof BIMO_SLOTS[number]
export type BimoEquipment = Record<BimoSlot, string | null>
export const DEFAULT_EQUIPMENT: BimoEquipment = { outfit: null, accessory: null, background: null }

// Explicit allowlist: never sell/equip an item the renderer cannot display yet.
export const BIMO_RENDERABLE = new Set(['outfit.hoodie', 'outfit.lavender_sweater', 'outfit.blue_bomber', 'outfit.coral_shirt', 'accessory.round_glasses', 'accessory.blue_headphones', 'accessory.mint_cap', 'accessory.lavender_beret', 'accessory.coral_scarf', 'background.clouds', 'background.peach', 'background.lavender', 'background.office', 'background.green_courtyard', 'background.beach', 'background.starry_evening'])
export function bimoLook(equipment: BimoEquipment): { outfit: BimoOutfit; background: BimoBackground; accessory: BimoAccessory } {
  return {
    outfit: equipment.outfit === 'outfit.hoodie' ? 'hoodie'
      : equipment.outfit === 'outfit.lavender_sweater' ? 'lavender-sweater'
        : equipment.outfit === 'outfit.blue_bomber' ? 'blue-bomber'
          : equipment.outfit === 'outfit.coral_shirt' ? 'coral-shirt' : 'classic',
    background: equipment.background === 'background.clouds' ? 'clouds'
      : equipment.background === 'background.peach' ? 'peach'
        : equipment.background === 'background.lavender' ? 'lavender'
          : equipment.background === 'background.office' ? 'office'
            : equipment.background === 'background.green_courtyard' ? 'green-courtyard'
              : equipment.background === 'background.beach' ? 'beach'
                : equipment.background === 'background.starry_evening' ? 'starry-evening' : 'mint',
    accessory: equipment.accessory === 'accessory.round_glasses' ? 'round-glasses'
      : equipment.accessory === 'accessory.blue_headphones' ? 'blue-headphones'
        : equipment.accessory === 'accessory.mint_cap' ? 'mint-cap'
          : equipment.accessory === 'accessory.lavender_beret' ? 'lavender-beret'
            : equipment.accessory === 'accessory.coral_scarf' ? 'coral-scarf' : 'none',
  }
}
export interface BimoItem {
  assetKey: string
  slot: BimoSlot
  productId: string
  name: string
  description: string | null
  emoji: string | null
  price: number
  owned: boolean
  purchasable: boolean
  released: boolean
  supported: boolean
}
export interface BimoState {
  enabled: boolean
  preview: boolean
  items: BimoItem[]
  equipment: BimoEquipment
}
