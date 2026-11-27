'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { ITEM_LAYERS, LAYER_LABELS, requiredLayers } from '@/modules/bimo-rig/validate'
import { DEFAULT_PLACEMENT, loadImport, placementMatrix, prepareImport } from '@/modules/bimo-rig/import.client'
import type { Placement } from '@/modules/bimo-rig/import.client'
import type { BimoArt, BimoItemKind, BimoLayerName } from '@/modules/bimo-rig'

export interface PreparedBimoInput {
  files: Partial<Record<BimoLayerName, File>>
  art: BimoArt | null
  error: string
  checking: boolean
}
export const EMPTY_BIMO_INPUT: PreparedBimoInput = { files: {}, art: null, error: '', checking: false }

/** Подсказка под полем: одна строка, подробности — в документации импорта. */
const HINTS: Record<BimoItemKind, string> = {
  background: 'PNG или WebP до 2 МБ, кадрируется по центру.',
  garment: 'Основа обязательна, правый рукав — если он нарисован отдельно. PNG или WebP до 2 МБ.',
  accessory: 'PNG или WebP до 2 МБ, прозрачный фон.',
  necklace: 'PNG или WebP до 2 МБ, прозрачный фон.',
}

/** Имя файла подсказывает слой: художник отдаёт пару outfit/sleeve одним экспортом. */
function layerFromFileName(name: string): BimoLayerName | null {
  if (/sleeve|рукав/i.test(name)) return 'sleeve'
  if (/outfit|основ/i.test(name)) return 'outfit'
  return null
}
interface BimoImportEditorProps { kind: BimoItemKind; onChange: (value: PreparedBimoInput) => void }
type ImportSource = Awaited<ReturnType<typeof loadImport>> & { filename: string; file: File }

export function BimoImportEditor({ kind, onChange }: BimoImportEditorProps) {
  const [sources, setSources] = useState<Partial<Record<BimoLayerName, ImportSource>>>({})
  const [fit, setFit] = useState<Placement>(DEFAULT_PLACEMENT)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const generation = useRef({ value: 0 })
  const owned = useRef(new Set<string>())
  const previews = useRef<string[][]>([])
  const drag = useRef<{ x: number; y: number; fit: Placement } | null>(null)
  const layers = ITEM_LAYERS[kind]

  useEffect(() => {
    const urls = owned.current, version = generation.current
    return () => { version.value++; for (const url of urls) URL.revokeObjectURL(url) }
  }, [])
  useEffect(() => {
    // Готовится то, что выбрано: необязательные слои просто не попадают
    // в набор. Рисунок не проверяется — как загрузили, так и сохранится.
    const ready = layers.filter(layer => sources[layer])
    if (loading || !requiredLayers(kind).every(layer => sources[layer])) return
    const request = generation.current.value
    let cancelled = false
    onChange({ ...EMPTY_BIMO_INPUT, checking: true })
    const timer = window.setTimeout(() => {
      void Promise.all(ready.map(async layer => ({ layer, ...await prepareImport(sources[layer]!.image, kind, fit, layer) }))).then(results => {
        if (cancelled || generation.current.value !== request) return
        const files: PreparedBimoInput['files'] = {}
        const art: BimoArt = { modelVersion: 4 }
        const urls: string[] = []
        for (const result of results) {
          const url = URL.createObjectURL(result.file)
          owned.current.add(url)
          urls.push(url)
          art[result.layer] = url
          files[result.layer] = result.file
        }
        previews.current.push(urls)
        onChange({ files, art, error: '', checking: false })
        while (previews.current.length > 2) {
          for (const old of previews.current.shift()!) { URL.revokeObjectURL(old); owned.current.delete(old) }
        }
      }).catch(reason => {
        if (!cancelled && generation.current.value === request) onChange({ ...EMPTY_BIMO_INPUT, error: reason instanceof Error ? reason.message : 'Не удалось подготовить рисунок' })
      })
    }, 120)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [sources, kind, fit, layers, loading, onChange])

  async function choose(files: Partial<Record<BimoLayerName, File>>, reset = false) {
    const request = ++generation.current.value
    setLoading(true)
    setError('')
    onChange({ ...EMPTY_BIMO_INPUT, checking: true })
    for (const layer of layers) {
      if (!files[layer]) continue
      const old = sources[layer]?.url
      if (old) { URL.revokeObjectURL(old); owned.current.delete(old) }
    }
    setSources(previous => Object.fromEntries(Object.entries(previous).filter(([layer]) => !files[layer as BimoLayerName])))
    const opened: Partial<Record<BimoLayerName, ImportSource>> = {}
    try {
      for (const layer of layers) {
        const file = files[layer]
        if (file) opened[layer] = { ...await loadImport(file), filename: file.name, file }
      }
      if (generation.current.value !== request) {
        for (const source of Object.values(opened)) URL.revokeObjectURL(source.url)
        return
      }
      for (const layer of layers) {
        const next = opened[layer]
        if (!next) continue
        owned.current.add(next.url)
      }
      setSources(previous => ({ ...previous, ...opened }))
      if (reset) setFit(DEFAULT_PLACEMENT)
      if (!layers.every(layer => opened[layer] || sources[layer])) onChange(EMPTY_BIMO_INPUT)
    } catch (reason) {
      for (const source of Object.values(opened)) URL.revokeObjectURL(source.url)
      if (generation.current.value === request) {
        const message = reason instanceof Error ? reason.message : 'Не удалось открыть рисунок'
        setError(message)
        onChange({ ...EMPTY_BIMO_INPUT, error: message })
      }
    } finally { if (generation.current.value === request) setLoading(false) }
  }
  /**
   * Части вещи выбираются одной кнопкой: имя файла решает, где рукав,
   * а где основная часть. Если подсказки в имени нет, файлы ложатся по
   * порядку выбора, и их всегда можно поменять местами.
   */
  function pick(chosen: File[]) {
    if (!chosen.length) return
    if (layers.length === 1) { void choose({ [layers[0]]: chosen[0] }); return }
    const byName = new Map<BimoLayerName, File>()
    const rest: File[] = []
    for (const file of chosen) {
      const named = layerFromFileName(file.name)
      if (named && layers.includes(named) && !byName.has(named)) byName.set(named, file)
      else rest.push(file)
    }
    const files: Partial<Record<BimoLayerName, File>> = Object.fromEntries(byName)
    // Безымянные файлы сначала занимают пустые слоты и только потом заменяют
    // уже выбранные: иначе второй файл вытеснял бы первый, и вещь оставалась
    // бы без половины.
    const free = layers.filter(layer => !files[layer] && !sources[layer])
    const taken = layers.filter(layer => !files[layer] && sources[layer])
    for (const layer of [...free, ...taken]) {
      if (!rest.length) break
      files[layer] = rest.shift()
    }
    void choose(files, true)
  }
  function swap() {
    const [first, second] = layers
    const left = sources[first]?.file, right = sources[second]?.file
    if (!left || !right) return
    void choose({ [first]: right, [second]: left })
  }
  const width = kind === 'background' ? 600 : 512, height = kind === 'background' ? 500 : 512
  const hasSource = Object.keys(sources).length > 0
  const chosenNames = layers.map(layer => sources[layer]?.filename).filter(Boolean) as string[]
  return <div className="space-y-3">
    <label className="block text-sm font-semibold">{layers.length > 1 ? 'Части вещи' : LAYER_LABELS[layers[0]]}
      <input type="file" accept="image/png,image/webp" multiple={layers.length > 1} disabled={loading}
        className="mt-1.5 block w-full cursor-pointer rounded-lg border border-[var(--apex-border)] bg-[var(--apex-bg)] text-xs font-normal text-[var(--apex-text-secondary)] file:mr-3 file:cursor-pointer file:rounded-l-lg file:border-0 file:bg-[var(--apex-surface)] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[var(--apex-text)] disabled:opacity-60"
        onChange={event => {
          const files = Array.from(event.target.files ?? [])
          event.target.value = ''
          pick(files)
        }} />
    </label>
    <p className="text-xs text-[var(--apex-text-secondary)]">{HINTS[kind]}</p>
    {chosenNames.length > 0 && (
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--apex-text-muted)]">
        <span className="break-all">{chosenNames.join(' · ')}</span>
        {layers.length > 1 && chosenNames.length === layers.length && (
          <button type="button" disabled={loading} onClick={swap}
            className="font-semibold text-[var(--apex-primary)] hover:underline disabled:opacity-60">поменять местами</button>
        )}
      </p>
    )}
    {loading &&<p role="status" className="text-sm text-[var(--apex-text-secondary)]">Открываем рисунок…</p>}
    {error && <p role="alert" className="rounded-xl border border-[var(--apex-danger-light)] bg-[var(--apex-error-bg)] px-3 py-2 text-sm font-medium text-[var(--apex-error-text)]">{error}</p>}
    {hasSource && <>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Общая подгонка рисунка на Бимо" className="mx-auto block w-full max-w-[300px] touch-none rounded-xl border border-[var(--apex-border)] bg-[var(--apex-bg)]"
        onPointerDown={event => { if (loading) return; event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, y: event.clientY, fit } }}
        onPointerMove={event => {
          if (loading || !drag.current) return
          const rect = event.currentTarget.getBoundingClientRect(), start = drag.current
          setFit({ ...start.fit, dx: Math.max(-300, Math.min(300, start.fit.dx + (event.clientX - start.x) * width / rect.width)), dy: Math.max(-300, Math.min(300, start.fit.dy + (event.clientY - start.y) * height / rect.height)) })
        }}
        onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }} onLostPointerCapture={() => { drag.current = null }}>
        {kind !== 'background' && <image href="/bimo/model-v4/reference.webp" width={512} height={512} opacity={0.3} />}
        {[...layers].reverse().map(layer => {
          const source = sources[layer]
          if (!source) return null
          const matrix = placementMatrix(source.image.naturalWidth, source.image.naturalHeight, kind, fit)
          return <image key={layer} href={source.url} x={matrix.x} y={matrix.y} width={source.image.naturalWidth * matrix.scale} height={source.image.naturalHeight * matrix.scale} />
        })}
      </svg>
      <div className="space-y-2 rounded-xl border border-[var(--apex-border)] px-3 py-2.5">
        <p className="flex items-baseline justify-between gap-3 text-[11px] font-bold uppercase tracking-wider text-[var(--apex-text-muted)]">Посадка
          <span className="font-medium normal-case tracking-normal">{kind === 'garment' ? 'обе части двигаются вместе' : 'тяните рисунок или ползунки'}</span>
        </p>
        {([['scale', 'Размер', 0.1, 3, 0.01], ['dx', 'По горизонтали', -300, 300, 1], ['dy', 'По вертикали', -300, 300, 1]] as const).map(([key, label, min, max, step]) => (
          <label key={key} className="block text-xs text-[var(--apex-text-secondary)]">
            <span className="flex items-center justify-between">{label}<span className="tabular-nums">{fit[key]}</span></span>
            <input disabled={loading} className="mt-1 block w-full" type="range" min={min} max={max} step={step} value={fit[key]} onChange={event => setFit(previous => ({ ...previous, [key]: Number(event.target.value) }))} />
          </label>
        ))}
        <Button size="sm" disabled={loading} onClick={() => setFit(DEFAULT_PLACEMENT)}>Сбросить посадку</Button>
      </div>
    </>}
  </div>
}
