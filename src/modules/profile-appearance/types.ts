// Типы магазина Бимо. Экипировка, образ и графика живут в движке `bimo-rig`:
// их используют и галерея, и админские превью, поэтому они не могут принадлежать
// этому модулю.

import type { BimoArtMap, BimoEquipment, BimoSlot } from '@/modules/bimo-rig'

export interface BimoItem {
  assetKey: string; slot: BimoSlot; productId: string; name: string
  description: string | null; emoji: string | null; price: number
  /** Набор эмодзи фона от админа: пустой — декор собирается по `emoji`. */
  decor: string[]
  owned: boolean; purchasable: boolean; released: boolean; supported: boolean
  /** Поля заказа с комментарием: без них вещь с обязательным комментарием не купить. */
  commentRequired: boolean; commentLabel: string | null; commentPlaceholder: string | null
}
export interface BimoState {
  enabled: boolean; preview: boolean; items: BimoItem[]
  equipment: BimoEquipment; catalogArt: BimoArtMap
}
