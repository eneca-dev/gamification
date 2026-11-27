import sharp from 'sharp'
import { MAX_LAYER_BYTES } from './validate'

/**
 * Приводит загруженный слой к lossless WebP. Содержимое рисунка не
 * проверяется: что администратор загрузил, то и сохраняется. Остаются только
 * технические требования хранилища — вес до 2 МБ и обычный PNG/WebP без
 * анимации, иначе файл не обработать и не отдать браузеру.
 */
export async function prepareLayer(bytes: Uint8Array): Promise<Buffer> {
  if (!bytes.byteLength || bytes.byteLength > MAX_LAYER_BYTES) throw new Error('Каждый слой — максимум 2 МБ')
  const image = sharp(bytes, { limitInputPixels: 1024 * 1024, failOn: 'warning' })
  const meta = await image.metadata()
  if (!['png', 'webp'].includes(meta.format ?? '') || (meta.pages ?? 1) !== 1) throw new Error('Нужен обычный PNG или WebP без анимации')
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).webp({ lossless: true }).toBuffer()
}
