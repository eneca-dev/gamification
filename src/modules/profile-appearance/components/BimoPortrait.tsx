'use client'

import { useEffect, useRef, useState } from 'react'
import { BIMO_ACTIONS, BIMO_BACKGROUNDS, BIMO_CANVAS_HEIGHT, BIMO_CANVAS_WIDTH, BIMO_RASTER_ACCESSORIES, PORTRAIT_EYES, bimoEyes, bimoSource, type BimoAccessory, type BimoBackground, type BimoEyes, type BimoOutfit } from '../scenes'

const WIDTH = BIMO_CANVAS_WIDTH
const HEIGHT = BIMO_CANVAS_HEIGHT
const images = new Map<string, Promise<HTMLImageElement>>()
const imageBytes = new Map<string, number>()
const MAX_IMAGES = 5
const MAX_DECODED_BYTES = 24 * 1024 * 1024

function trimImages() {
  let bytes = [...imageBytes.values()].reduce((sum, size) => sum + size, 0)
  for (const key of images.keys()) {
    if (images.size <= MAX_IMAGES && bytes <= MAX_DECODED_BYTES) break
    bytes -= imageBytes.get(key) ?? 0
    images.delete(key)
    imageBytes.delete(key)
  }
}

function loadImage(src: string) {
  let pending = images.get(src)
  if (pending) { images.delete(src); images.set(src, pending) }
  if (!pending) {
    const image = new window.Image()
    image.src = src
    pending = image.decode().then(() => {
      if (images.get(src) === pending) {
        imageBytes.set(src, image.naturalWidth * image.naturalHeight * 4)
        trimImages()
      }
      return image
    }).catch((error) => {
      if (images.get(src) === pending) { images.delete(src); imageBytes.delete(src) }
      throw error
    })
    images.set(src, pending)
    trimImages()
  }
  return pending
}

function drawGlasses(context: CanvasRenderingContext2D, eyes: BimoEyes, offsetY: number) {
  const [lx, ly, rx, ry] = eyes
  const distance = Math.hypot(rx - lx, ry - ly)
  context.save()
  context.translate(lx, ly + offsetY)
  context.rotate(Math.atan2(ry - ly, rx - lx))
  context.scale(distance / 40, distance / 40)
  context.strokeStyle = '#263b39'
  context.fillStyle = 'rgba(218, 247, 246, 0.10)'
  context.lineWidth = 1.7
  for (const x of [0, 40]) {
    context.beginPath()
    context.ellipse(x, 0, 15, 14, 0, 0, Math.PI * 2)
    context.fill()
    context.stroke()
  }
  context.beginPath()
  context.moveTo(15, -1)
  context.quadraticCurveTo(20, -5, 25, -1)
  context.moveTo(-15, -2)
  context.lineTo(-21, -5)
  context.moveTo(55, -2)
  context.lineTo(61, -5)
  context.stroke()
  context.restore()
}

function drawRasterAccessory(context: CanvasRenderingContext2D, image: HTMLImageElement, outfit: BimoOutfit, action: typeof BIMO_ACTIONS[number], frame: number | null) {
  const base = frame === null ? PORTRAIT_EYES : action.eyes[frame]
  const target = bimoEyes(outfit, action, frame)
  const offset = frame === null ? 64 : HEIGHT - action.height
  const rotation = Math.atan2(target[3] - target[1], target[2] - target[0]) - Math.atan2(base[3] - base[1], base[2] - base[0])
  const scale = Math.hypot(target[2] - target[0], target[3] - target[1]) / Math.hypot(base[2] - base[0], base[3] - base[1])
  context.save()
  context.translate((target[0] + target[2]) / 2, (target[1] + target[3]) / 2 + offset)
  context.rotate(rotation)
  context.scale(scale, scale)
  context.translate(-(base[0] + base[2]) / 2, -(base[1] + base[3]) / 2 - offset)
  if (frame === null) context.drawImage(image, 0, 64, 256, 256)
  else context.drawImage(image, frame % 4 * action.width, Math.floor(frame / 4) * action.height, action.width, action.height, 0, offset, action.width, action.height)
  context.restore()
}

interface BimoPortraitProps {
  outfit?: BimoOutfit
  background?: BimoBackground
  accessory?: BimoAccessory
  actionIndex?: number
  onPlay?: () => void
}

export function BimoPortrait({ outfit = 'classic', background = 'mint', accessory = 'none', actionIndex = 0, onPlay }: BimoPortraitProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [run, setRun] = useState(0)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const action = BIMO_ACTIONS[actionIndex] ?? BIMO_ACTIONS[0]

  useEffect(() => {
    let cancelled = false
    let raf = 0
    let stop: (() => void) | undefined
    const play = run > 0
    const raster = accessory === 'none' || accessory === 'round-glasses' ? null : BIMO_RASTER_ACCESSORIES[accessory]
    void Promise.all([
      loadImage(bimoSource(outfit)),
      play ? loadImage(bimoSource(outfit, action.id)) : Promise.resolve(null),
      loadImage(BIMO_BACKGROUNDS[background]),
      raster ? loadImage(raster.portrait) : Promise.resolve(null),
      raster && play ? loadImage(raster[action.id]) : Promise.resolve(null),
    ]).then(([portrait, sprite, backdrop, accessoryPortrait, accessorySprite]) => {
      if (cancelled) return
      const context = canvasRef.current?.getContext('2d')
      if (!context) throw new Error('Canvas unavailable')
      if (sprite && (sprite.width !== action.width * 4 || sprite.height !== action.height * 4)) throw new Error('Unexpected sprite dimensions')
      if (accessoryPortrait && (accessoryPortrait.width !== 512 || accessoryPortrait.height !== 512)) throw new Error('Unexpected accessory portrait dimensions')
      if (accessorySprite && (accessorySprite.width !== action.width * 4 || accessorySprite.height !== action.height * 4)) throw new Error('Unexpected accessory sprite dimensions')
      const paint = (frame: number | null) => {
        context.clearRect(0, 0, WIDTH, HEIGHT)
        context.drawImage(backdrop, 0, 0, WIDTH, HEIGHT)
        if (frame !== null && sprite) {
          context.drawImage(sprite, frame % 4 * action.width, Math.floor(frame / 4) * action.height, action.width, action.height, 0, HEIGHT - action.height, action.width, action.height)
        } else {
          context.drawImage(portrait, 0, 64, 256, 256)
        }
        if (accessory === 'round-glasses') drawGlasses(context, bimoEyes(outfit, action, frame), frame === null ? 64 : HEIGHT - action.height)
        else {
          const layer = frame === null ? accessoryPortrait : accessorySprite
          if (layer) drawRasterAccessory(context, layer, outfit, action, frame)
        }
      }
      setFailed(false)
      if (!play || document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { paint(null); setBusy(false); return }
      const duration = action.durations.reduce((sum: number, value) => sum + value, 0)
      const startedAt = performance.now()
      setBusy(true)
      let lastFrame = -1
      stop = () => { cancelAnimationFrame(raf); paint(null); setBusy(false) }
      const tick = (now: number) => {
        if (cancelled) return
        const elapsed = now - startedAt
        if (elapsed >= duration) { stop?.(); return }
        let frame = 0
        let end: number = action.durations[0]
        while (frame < 15 && elapsed >= end) end += action.durations[++frame]
        if (frame !== lastFrame) { paint(frame); lastFrame = frame }
        raf = requestAnimationFrame(tick)
      }
      tick(startedAt)
    }).catch(() => {
      if (cancelled) return
      setFailed(true)
      setBusy(false)
    })
    const onHidden = () => { if (document.hidden) stop?.() }
    document.addEventListener('visibilitychange', onHidden)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      document.removeEventListener('visibilitychange', onHidden)
    }
  }, [action, outfit, background, accessory, run])

  return (
    <div className="flex flex-col items-center gap-2">
      <button data-bimo-canvas type="button" onClick={() => { if (busy) return; setBusy(true); setFailed(false); setRun((value) => value + 1); onPlay?.() }}
        aria-label={action.label} aria-busy={busy}
        title="Нажмите на Бимо, чтобы запустить движение"
        className="relative block w-[180px] max-w-full rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--apex-focus)]">
        <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} aria-hidden="true" className="block aspect-[6/5] w-full" />
      </button>
      {failed && <p role="status" className="max-w-64 text-center text-xs text-[var(--apex-text-muted)]">Не удалось загрузить образ. Нажмите «Повторить».</p>}
      {failed && <button type="button" className="rounded border px-3 py-1 text-sm" onClick={() => { setBusy(false); setRun((value) => value + 1) }}>Повторить</button>}
    </div>
  )
}
