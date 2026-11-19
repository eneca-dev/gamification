// Package approved accessory artwork on the same canvas used by the admin importer.
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { SHIPPED_ACCESSORIES } from './shipped.mjs'

const root = path.resolve(import.meta.dirname, '../..')
const artDirectory = path.join(root, 'src/docs-features/bimo-rig/art/accessories')
const prompts = JSON.parse(await fs.readFile(path.join(artDirectory, 'prompts.json'), 'utf8'))
const items = SHIPPED_ACCESSORIES.map((name) => {
  if (!prompts[name]) throw new Error(`Нет промпта для отгружаемого аксессуара ${name}`)
  return [name, prompts[name]]
})
const output = path.join(root, 'public/bimo/accessories-v4')
await fs.mkdir(output, { recursive: true })
for (const [name, item] of items) {
  const artwork = await sharp(path.join(artDirectory, item.source))
    .trim({ background: '#00000000', threshold: 1 })
    .resize({ width: item.placement.width }).png().toBuffer()
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: '#00000000' } })
    .composite([{ input: artwork, left: item.placement.left, top: item.placement.top }])
    .png().toFile(path.join(output, `${name}.png`))
  console.log(`Prepared ${name}.png on the 1024×1024 accessory template`)
}
