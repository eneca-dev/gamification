import sharp from 'sharp'
import { MAX_LAYER_BYTES, validateGarmentPair, validatePixels } from './validate'
import type { BimoLayerName } from './types'

export async function prepareLayer(bytes: Uint8Array, layer: BimoLayerName): Promise<Buffer> {
  if (!bytes.byteLength || bytes.byteLength > MAX_LAYER_BYTES) throw new Error('Каждый слой — максимум 2 МБ')
  const image = sharp(bytes, { limitInputPixels: 1024 * 1024, failOn: 'warning' })
  const meta = await image.metadata()
  if (!['png', 'webp'].includes(meta.format ?? '') || (meta.pages ?? 1) !== 1) throw new Error('Нужен обычный PNG или WebP без анимации')
  if (meta.orientation && meta.orientation !== 1) throw new Error('Экспортируйте слой без поворота EXIF')
  if (layer !== 'image' && !meta.hasAlpha) throw new Error('У слоя должен быть прозрачный фон')
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const result = validatePixels(layer, data, info.width, info.height)
  if (result.error) throw new Error(result.error)
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).webp({ lossless: true }).toBuffer()
}

export async function validatePreparedGarment(outfit: Uint8Array, sleeve: Uint8Array): Promise<void> {
  const pixels = await Promise.all([outfit, sleeve].map(bytes => sharp(bytes).ensureAlpha().raw().toBuffer()))
  const error = validateGarmentPair(pixels[0], pixels[1])
  if (error) throw new Error(error)
}
