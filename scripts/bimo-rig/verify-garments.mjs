// Validate packaged clothing and inspect it on the production model before importing it.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import sharp from 'sharp'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { compileRig } from './compile-check.mjs'
import { GARMENT_PROMPTS, SHIPPED_BACKGROUNDS, backgroundSrc } from './shipped.mjs'

const { root, out } = await compileRig()
const { prepareLayer, validatePreparedGarment } = await import(pathToFileURL(path.join(out, 'validate.server.mjs')).href)
const { BimoModelFigure } = await import(pathToFileURL(path.join(out, 'components/BimoModelFigure.mjs')).href)
const { sampleMotion, REACTIONS } = await import(pathToFileURL(path.join(out, 'motion.mjs')).href)
const { DEFAULT_LOOK } = await import(pathToFileURL(path.join(out, 'rig.mjs')).href)
const { HAND_MASK_TOP, HAND_ROWS } = await import(pathToFileURL(path.join(out, 'hand-mask-v4.mjs')).href)
const garments = JSON.parse(await fs.readFile(path.join(root, 'src/docs-features/bimo-rig/art/garments', process.argv[2] ?? GARMENT_PROMPTS), 'utf8'))
const output = path.join(root, 'tmp/rig/garments')
await fs.mkdir(output, { recursive: true })
const backgrounds = SHIPPED_BACKGROUNDS
const accessories = [null, { head: '/bimo/accessories-v4/mint-cap.png', modelVersion: 4 }, { neck: '/bimo/accessories-v4/starry-scarf.png', modelVersion: 4 }]
const poses = [[null, 0], ...REACTIONS.map(reaction => [reaction.id, reaction.duration / 2])]
const assets = new Map()
const overview = [], details = []
const overviewColumns = Math.min(3, Object.keys(garments).length)
let renders = 0

function opaqueNeighborhood(pixels, x, y) {
  return [-2, 0, 2].every(dy => [-2, 0, 2].every(dx => pixels[((y + dy) * 1024 + x + dx) * 4 + 3] >= 220))
}

async function renderLook(look, pose, scale = 1) {
  let markup = renderToStaticMarkup(createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', width: 600 * scale, height: 500 * scale, viewBox: '0 0 600 500' }, createElement(BimoModelFigure, { look, pose })))
  for (const src of new Set([...markup.matchAll(/href="(\/[^"]+)"/g)].map(match => match[1]))) {
    if (!assets.has(src)) assets.set(src, 'data:image/png;base64,' + (await sharp(path.join(root, 'public', src)).png().toBuffer()).toString('base64'))
    markup = markup.replaceAll(`href="${src}"`, `href="${assets.get(src)}"`)
  }
  return sharp(Buffer.from(markup)).flatten({ background: '#eef2f2' }).png().toBuffer()
}

for (const [itemIndex, [name, specification]] of Object.entries(garments).entries()) {
  const itemName = path.basename(name)
  const prepared = {}, pixels = {}
  for (const layer of ['outfit', 'sleeve']) {
    const bytes = await fs.readFile(path.join(root, 'public/bimo/items', name, `${layer}.png`))
    prepared[layer] = await prepareLayer(bytes, layer)
    pixels[layer] = await sharp(bytes).ensureAlpha().raw().toBuffer()
    const restored = await sharp(prepared[layer]).ensureAlpha().raw().toBuffer()
    assert.ok(restored.equals(pixels[layer]), `${layer}: server preparation must preserve the exact fitted pixels`)
    let coveredPalmPixels = 0
    for (const [row, spans] of HAND_ROWS.entries()) {
      for (let index = 0; index < spans.length; index += 2) {
        for (let y = (HAND_MASK_TOP + row) * 2; y < (HAND_MASK_TOP + row + 1) * 2; y++) {
          for (let x = spans[index] * 2; x < (spans[index + 1] + 1) * 2; x++) {
            if (pixels[layer][(y * 1024 + x) * 4 + 3] >= 32) coveredPalmPixels++
          }
        }
      }
    }
    assert.equal(coveredPalmPixels, 0, `${layer}: every protected palm pixel must remain open`)
  }
  await validatePreparedGarment(prepared.outfit, prepared.sleeve)
  // Include short sleeves too, excluding two antialiased pixels at the hidden cut edge.
  let mirroredPixels = 0
  for (let y = 490; y < 740; y++) for (let x = 660; x < 1022; x++) {
    const right = (y * 1024 + x) * 4
    const left = (y * 1024 + 1023 - x) * 4
    if (!opaqueNeighborhood(pixels.sleeve, x, y) || !opaqueNeighborhood(pixels.outfit, 1023 - x, y)) continue
    assert.deepEqual(pixels.sleeve.subarray(right, right + 4), pixels.outfit.subarray(left, left + 4), `asymmetric sleeve at ${x},${y}`)
    mirroredPixels++
  }
  assert.ok(mirroredPixels > 1000, 'the symmetry check must include a substantial visible sleeve area')
  const garment = { outfit: `/bimo/items/${name}/outfit.png`, sleeve: `/bimo/items/${name}/sleeve.png`, modelVersion: 4 }
  const panels = []
  for (const [backgroundIndex, background] of backgrounds.entries()) {
    for (const [accessoryIndex, accessory] of accessories.entries()) {
      for (const [poseIndex, [reaction, time]] of poses.entries()) {
        const look = { ...DEFAULT_LOOK, garment, accessory, backgroundSrc: backgroundSrc(background) }
        const raster = await renderLook(look, sampleMotion(time, reaction, time))
        renders++
        if (backgroundIndex !== 0) continue
        panels.push({ input: await sharp(raster).resize(300, 250).png().toBuffer(), left: poseIndex * 300, top: accessoryIndex * 275 + 25 })
        const label = `${['plain', 'cap', 'scarf'][accessoryIndex]} · ${reaction ?? 'idle'}`
        panels.push({ input: Buffer.from(`<svg width="300" height="25"><text x="150" y="18" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#26382f">${label}</text></svg>`), left: poseIndex * 300, top: accessoryIndex * 275 })
        if (poseIndex === 0) await fs.writeFile(path.join(output, `${itemName}-${['plain', 'cap', 'scarf'][accessoryIndex]}.png`), raster)
        if (accessoryIndex === 0 && poseIndex === 0) {
          const left = itemIndex % overviewColumns * 480
          const top = Math.floor(itemIndex / overviewColumns) * 435
          const title = (specification.title ?? itemName).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
          const label = Buffer.from(`<svg width="480" height="35"><text x="240" y="25" text-anchor="middle" font-family="sans-serif" font-size="21" fill="#26382f">${title}</text></svg>`)
          overview.push({ input: label, left, top }, { input: await sharp(raster).resize(480, 400).png().toBuffer(), left, top: top + 35 })
          const large = await renderLook(look, sampleMotion(time, reaction, time), 2)
          const shoulders = await sharp(large).extract({ left: 430, top: 455, width: 340, height: 130 }).resize(600, 230).png().toBuffer()
          const wrists = await sharp(large).extract({ left: 380, top: 625, width: 440, height: 120 }).resize(600, 164).png().toBuffer()
          details.push({ input: label, left: 360, top: itemIndex * 270 }, { input: shoulders, left: 0, top: itemIndex * 270 + 35 }, { input: wrists, left: 600, top: itemIndex * 270 + 65 })
        }
      }
    }
  }
  await sharp({ create: { width: 1200, height: 825, channels: 3, background: '#eef2f2' } }).composite(panels).png().toFile(path.join(output, `${itemName}-poses.png`))
  console.log(`${name}: validated two layers, shoulder overlap, lossless round-trip and ${mirroredPixels} exactly mirrored sleeve pixels`)
}
await sharp({ create: { width: overviewColumns * 480, height: Math.ceil(Object.keys(garments).length / overviewColumns) * 435, channels: 3, background: '#eef2f2' } }).composite(overview).png().toFile(path.join(output, 'collection-overview.png'))
await sharp({ create: { width: 1200, height: Object.keys(garments).length * 270, channels: 3, background: '#eef2f2' } }).composite(details).png().toFile(path.join(output, 'collection-details.png'))
console.log(`Rendered ${renders} production model poses across six backgrounds and three accessory combinations`)
