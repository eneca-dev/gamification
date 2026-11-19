'use client'

import { ITEM_LAYERS, MAX_LAYER_BYTES, validatePixels } from './validate'
import type { BimoItemKind, BimoLayerName } from './types'

export interface Placement { dx: number; dy: number; scale: number }
export const DEFAULT_PLACEMENT: Placement = { dx: 0, dy: 0, scale: 1 }
export function placementMatrix(width: number, height: number, kind: BimoItemKind, fit: Placement) {
  const targetWidth = kind === 'background' ? 600 : 512, targetHeight = kind === 'background' ? 500 : 512
  const base = kind === 'background' ? Math.max(targetWidth / width, targetHeight / height) : Math.min(targetWidth / width, targetHeight / height)
  const scale = base * fit.scale
  return { scale, x: (targetWidth - width * scale) / 2 + fit.dx, y: (targetHeight - height * scale) / 2 + fit.dy, width: targetWidth, height: targetHeight }
}
export function sourceTransparencyError(data: Uint8ClampedArray): string | null {
  let transparent = 0
  for (let i = 3; i < data.length; i += 4) if (data[i] < 16) transparent++
  return transparent >= Math.max(4, Math.ceil(data.length / 4 * 0.01)) ? null : 'У исходного рисунка нет прозрачного фона. Уберите подложку до загрузки'
}
export async function loadImport(file: File, kind: BimoItemKind): Promise<{ image: HTMLImageElement; url: string }> {
  if (!['image/png', 'image/webp'].includes(file.type) || !file.size || file.size > MAX_LAYER_BYTES) throw new Error('Нужен PNG или WebP, максимум 2 МБ')
  const url = URL.createObjectURL(file)
  try {
    const image = new Image(); image.src = url; await image.decode()
    if (image.naturalWidth > 4096 || image.naturalHeight > 4096) throw new Error('Изображение слишком большое. Экспортируйте его в пределах 4096×4096')
    if (kind !== 'background') {
      const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) throw new Error('Не удалось проверить прозрачность исходника')
      context.drawImage(image, 0, 0)
      const error = sourceTransparencyError(context.getImageData(0, 0, canvas.width, canvas.height).data)
      if (error) throw new Error(error)
    }
    return { image, url }
  } catch (error) { URL.revokeObjectURL(url); throw error }
}
export async function prepareImport(image: HTMLImageElement, kind: BimoItemKind, fit: Placement, layer: BimoLayerName = ITEM_LAYERS[kind][0]) {
  const matrix = placementMatrix(image.naturalWidth, image.naturalHeight, kind, fit)
  const ratio = kind === 'background' ? 1 : 2
  const canvas = document.createElement('canvas'); canvas.width = matrix.width * ratio; canvas.height = matrix.height * ratio
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Не удалось подготовить изображение')
  context.scale(ratio, ratio)
  context.drawImage(image, matrix.x, matrix.y, image.naturalWidth * matrix.scale, image.naturalHeight * matrix.scale)
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
  const validation = validatePixels(layer, pixels.data, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
  if (!blob || blob.size > MAX_LAYER_BYTES) throw new Error('Не удалось подготовить файл в пределах 2 МБ')
  return { file: new File([blob], `${layer}.png`, { type: 'image/png' }), pixels: pixels.data, error: validation.error }
}
