// Клиентобезопасный API модуля: графика Бимо и преобразование экипировки в образ.
// Серверные queries остаются в index-less модуле и импортируются напрямую страницами.

export { BimoPortrait } from './components/BimoPortrait'
export { bimoThumbLayers, bimoPortraitEyes, GLASSES_FILL, GLASSES_STROKE, BIMO_CANVAS_HEIGHT, BIMO_CANVAS_WIDTH, BIMO_PORTRAIT_CELL, BIMO_PORTRAIT_OFFSET_Y } from './scenes'
export type { BimoAccessory, BimoBackground, BimoOutfit, BimoThumbLayers } from './scenes'
export { bimoLook, DEFAULT_EQUIPMENT } from './types'
export type { BimoEquipment, BimoSlot } from './types'
