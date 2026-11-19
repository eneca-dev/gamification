// Export fitted clothing pairs from one complete illustration on the shared v4 canvas.
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { GARMENT_PROMPTS } from './shipped.mjs'

const root = path.resolve(import.meta.dirname, '../..')
const artDirectory = path.join(root, 'src/docs-features/bimo-rig/art/garments')
const garments = JSON.parse(await fs.readFile(path.join(artDirectory, process.argv[2] ?? GARMENT_PROMPTS), 'utf8'))

for (const [name, garment] of Object.entries(garments)) {
  const source = await sharp(path.join(artDirectory, garment.source)).resize(1024, 1024).png().toBuffer()
  const image = `<image href="data:image/png;base64,${source.toString('base64')}" y="${garment.offsetY}" width="512" height="512"/>`
  const layers = {
    outfit: `<defs><clipPath id="area"><path d="${garment.outfitClip}"/></clipPath></defs><g clip-path="url(#area)">${image}</g>`,
    sleeve: `<defs><clipPath id="area"><path d="${garment.sleeveClip}"/></clipPath></defs><g transform="translate(512 0) scale(-1 1)"><g clip-path="url(#area)">${image}</g></g>`,
  }
  const output = path.join(root, 'public/bimo/items', name)
  await fs.mkdir(output, { recursive: true })
  for (const [layer, content] of Object.entries(layers)) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 512 512">${content}</svg>`
    // Match the storage codec so transparent RGB is normalized before the import round-trip.
    const prepared = await sharp(Buffer.from(svg)).webp({ lossless: true }).toBuffer()
    await sharp(prepared).png().toFile(path.join(output, `${layer}.png`))
  }
  console.log(`Prepared ${name}: outfit.png and a mirrored sleeve.png`)
}
