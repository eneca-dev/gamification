// Package the selected cartoon artwork at the importer's native 600×500 canvas.
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { SHIPPED_BACKGROUNDS } from './shipped.mjs'

const root = path.resolve(import.meta.dirname, '../..')
const source = path.join(root, 'src/docs-features/bimo-rig/art/backgrounds')
const output = path.join(root, 'public/bimo/backgrounds-v4')
const prompts = JSON.parse(await fs.readFile(path.join(source, 'prompts.json'), 'utf8'))
await fs.mkdir(output, { recursive: true })
for (const name of SHIPPED_BACKGROUNDS) {
  const entry = prompts[name]
  if (!entry) throw new Error(`Нет промпта для отгружаемого фона ${name}`)
  const png = await sharp(await fs.readFile(path.join(source, entry.source)))
    .resize(600, 500, { fit: 'cover', position: 'centre' }).png().toBuffer()
  // Бесплатный мятный фон отдаётся приложением как WebP, остальные остаются PNG.
  if (name === 'mint') await sharp(png).webp({ lossless: true }).toFile(path.join(output, 'mint.webp'))
  else await fs.writeFile(path.join(output, `${name}.png`), png)
  console.log(`${name}: 600×500, ${Math.round(png.length / 1024)} KiB`)
}
