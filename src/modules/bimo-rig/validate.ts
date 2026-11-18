import type { BimoArt, BimoItemKind, BimoLayerName } from './types'
import { HAND_MASK_TOP, HAND_ROWS } from './hand-mask-v4'

export const ART_VERSION = 4
export const MAX_LAYER_BYTES = 2 * 1024 * 1024
export const ITEM_LAYERS: Record<BimoItemKind, readonly BimoLayerName[]> = {
  garment: ['outfit', 'sleeve'], accessory: ['head'], necklace: ['neck'], background: ['image'],
}
export const LAYER_LABELS: Record<BimoLayerName, string> = {
  outfit: 'Основная часть', sleeve: 'Правый рукав', head: 'Аксессуар на голову', neck: 'Аксессуар на шею', image: 'Фон',
}
type Point = readonly [number, number]
export const LAYER_ZONES: Partial<Record<BimoLayerName, readonly Point[]>> = {
  outfit: [[180, 215], [321, 215], [340, 285], [333, 391], [163, 391], [180, 358], [124, 352], [131, 315], [159, 258]],
  sleeve: [[264, 215], [332, 215], [382, 315], [388, 359], [334, 367], [298, 310], [266, 290]],
  head: [[95, 0], [417, 0], [417, 234], [95, 234]],
  neck: [[188, 210], [324, 210], [337, 300], [175, 300]],
}
export const REQUIRED_AREAS: Partial<Record<BimoLayerName, readonly Point[]>> = {
  outfit: [[227, 270], [285, 270], [296, 368], [216, 368]],
  sleeve: [[294, 244], [301, 247], [309, 263], [301, 267]],
}
export function insideZone(x: number, y: number, polygon: readonly Point[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ax, ay] = polygon[i], [bx, by] = polygon[j]
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside
  }
  return inside
}
function hasDetachedFabric(data: Uint8Array | Uint8ClampedArray, width: number, height: number): boolean {
  const visited = new Uint8Array(width * height), queue = new Int32Array(visited.length)
  let components = 0
  for (let start = 0; start < visited.length; start++) {
    if (visited[start] || data[start * 4 + 3] < 32) continue
    let read = 0, write = 1
    queue[0] = start; visited[start] = 1
    while (read < write) {
      const pixel = queue[read++], x = pixel % width, y = Math.floor(pixel / width)
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy, next = ny * width + nx
        if (nx < 0 || nx >= width || ny < 0 || ny >= height || visited[next] || data[next * 4 + 3] < 32) continue
        visited[next] = 1; queue[write++] = next
      }
    }
    if (++components > 1) return true
  }
  return false
}
export interface PixelValidation { error: string | null; outside: number[] }
export function validatePixels(layer: BimoLayerName, data: Uint8Array | Uint8ClampedArray, width: number, height: number): PixelValidation {
  const fail = (error: string, outside: number[] = []): PixelValidation => ({ error: `${LAYER_LABELS[layer]}: ${error}`, outside })
  const expected = layer === 'image' ? [600, 500] : [1024, 1024]
  if (width !== expected[0] || height !== expected[1]) return fail(`нужен холст ${expected[0]}×${expected[1]}`)
  if (data.length !== width * height * 4) return fail('не удалось прочитать пиксели')
  const zone = LAYER_ZONES[layer]
  const ratio = layer === 'image' ? 1 : 2
  let filled = 0, transparent = 0, clipped = false, onHands = 0
  const outside: number[] = []
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const alpha = data[(y * width + x) * 4 + 3]
    if (alpha < 16) transparent++
    if (alpha < 32) continue
    filled++
    if (!x || !y || x === width - 1 || y === height - 1) clipped = true
    if (zone && !insideZone((x + 0.5) / ratio, (y + 0.5) / ratio, zone)) outside.push(y * width + x)
    const hand = HAND_ROWS[Math.floor(y / ratio) - HAND_MASK_TOP]
    if ((layer === 'outfit' || layer === 'sleeve') && hand) {
      const column = Math.floor(x / ratio)
      for (let i = 0; i < hand.length; i += 2) if (column >= hand[i] && column <= hand[i + 1]) { onHands++; break }
    }
  }
  if (filled < (layer === 'image' ? 1000 : 80)) return fail('изображение пустое или слишком маленькое')
  if (layer === 'image') return { error: null, outside: [] }
  if (transparent < width * height / 2) return fail('нужен прозрачный фон и только рисунок вещи')
  if (clipped) return fail('вещь касается края холста и может быть обрезана. Уменьшите её или измените положение')
  if (onHands > 3 * ratio * ratio) return fail('одежда закрывает кисти. Оставьте лапы Бимо открытыми')
  if (outside.length / filled > 0.02) return fail('рисунок выходит за шаблон. Уменьшите вещь или измените положение', outside)
  const required = REQUIRED_AREAS[layer]
  if (required) {
    if (hasDetachedFabric(data, width, height)) return fail('одежда должна быть цельным рисунком: найдены отдельные фрагменты')
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (insideZone((x + 0.5) / ratio, (y + 0.5) / ratio, required) && data[(y * width + x) * 4 + 3] < 220) {
        return fail(layer === 'sleeve' ? 'не закрыто крепление плеча. Заполните обязательную область шаблона' : 'на корпусе не хватает ткани. Заполните обязательную область шаблона без отверстий')
      }
    }
  }
  return { error: null, outside: [] }
}
export function parseRigArt(raw: unknown, slot: string, version: unknown): BimoArt | null {
  if (version !== ART_VERSION || !raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const art = raw as Record<string, unknown>
  const keys = slot === 'outfit' ? ['outfit', 'sleeve'] : slot === 'background' ? ['image'] : slot === 'accessory' ? ['head', 'neck'] : []
  const present = keys.filter(key => typeof art[key] === 'string' && (art[key] as string).trim().length > 0)
  const count = slot === 'outfit' ? 2 : 1
  if (present.length !== count || Object.keys(art).some(key => !present.includes(key))) return null
  return { ...Object.fromEntries(present.map(key => [key, art[key]])), modelVersion: version }
}

export function validateGarmentPair(outfit: Uint8Array | Uint8ClampedArray, sleeve: Uint8Array | Uint8ClampedArray): string | null {
  if (outfit.length !== 1024 * 1024 * 4 || sleeve.length !== outfit.length) return 'Обе части должны иметь общий холст 1024×1024'
  let overlap = 0
  for (let y = 230; y < 278; y++) for (let x = 274; x < 320; x++) {
    const index = ((y * 2) * 1024 + x * 2) * 4 + 3
    if (outfit[index] >= 220 && sleeve[index] >= 220) overlap++
  }
  if (overlap < 12) return 'Части расходятся в плече. Проверьте общий холст, посадку и запас ткани у крепления рукава'
  return null
}
