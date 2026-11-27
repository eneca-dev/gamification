import type { BimoArt, BimoItemKind, BimoLayerName } from './types'

export const ART_VERSION = 4
export const MAX_LAYER_BYTES = 2 * 1024 * 1024
export const ITEM_LAYERS: Record<BimoItemKind, readonly BimoLayerName[]> = {
  garment: ['outfit', 'sleeve'], accessory: ['head'], necklace: ['neck'], background: ['image'],
}
/**
 * Слои, без которых вещь всё равно сохраняется и рисуется. Правый рукав нужен
 * только тем образам, где он нарисован отдельно: если его нет, модель рисует
 * лапу как есть.
 */
export const OPTIONAL_LAYERS: readonly BimoLayerName[] = ['sleeve']
export const LAYER_LABELS: Record<BimoLayerName, string> = {
  outfit: 'Основная часть', sleeve: 'Правый рукав', head: 'Аксессуар на голову', neck: 'Аксессуар на шею', image: 'Фон',
}

/** Слои, которые обязаны быть у вещи этого типа. */
export function requiredLayers(kind: BimoItemKind): readonly BimoLayerName[] {
  return ITEM_LAYERS[kind].filter(layer => !OPTIONAL_LAYERS.includes(layer))
}

/**
 * Разбор графики каталога. Проверяется только форма записи: версия, набор
 * ключей и то, что адреса непустые. Содержимое рисунков не проверяется —
 * за вид вещи отвечает администратор, который её загрузил.
 */
export function parseRigArt(raw: unknown, slot: string, version: unknown): BimoArt | null {
  if (version !== ART_VERSION || !raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const art = raw as Record<string, unknown>
  const keys = slot === 'outfit' ? ['outfit', 'sleeve'] : slot === 'background' ? ['image'] : slot === 'accessory' ? ['head', 'neck'] : []
  const present = keys.filter(key => typeof art[key] === 'string' && (art[key] as string).trim().length > 0)
  // У одежды обязательна основная часть, рукав — по желанию. У остальных
  // слотов ровно один рисунок.
  const valid = slot === 'outfit' ? present.includes('outfit') : present.length === 1
  if (!valid || Object.keys(art).some(key => key !== 'modelVersion' && !present.includes(key))) return null
  return { ...Object.fromEntries(present.map(key => [key, art[key]])), modelVersion: version }
}
