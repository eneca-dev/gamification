'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { ITEM_LAYERS, LAYER_LABELS, validateGarmentPair } from '@/modules/bimo-rig/validate'
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
interface BimoImportEditorProps { kind: BimoItemKind; onChange: (value: PreparedBimoInput) => void }
type ImportSource = Awaited<ReturnType<typeof loadImport>> & { filename: string }

export function BimoImportEditor({ kind, onChange }: BimoImportEditorProps) {
  const [sources, setSources] = useState<Partial<Record<BimoLayerName, ImportSource>>>({})
  const [fit, setFit] = useState<Placement>(DEFAULT_PLACEMENT)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const generation = useRef({ value: 0 })
  const exampleRequest = useRef<{ controller: AbortController | null }>({ controller: null })
  const owned = useRef(new Set<string>())
  const previews = useRef<string[][]>([])
  const drag = useRef<{ x: number; y: number; fit: Placement } | null>(null)
  const layers = ITEM_LAYERS[kind]

  useEffect(() => {
    const urls = owned.current, version = generation.current, pendingExample = exampleRequest.current
    return () => { version.value++; pendingExample.controller?.abort(); for (const url of urls) URL.revokeObjectURL(url) }
  }, [])
  useEffect(() => {
    if (loading || !layers.every(layer => sources[layer])) return
    const request = generation.current.value
    let cancelled = false
    const first = sources[layers[0]]!
    const sameCanvas = layers.every(layer => sources[layer]!.image.naturalWidth === first.image.naturalWidth && sources[layer]!.image.naturalHeight === first.image.naturalHeight)
    if (!sameCanvas) {
      onChange({ ...EMPTY_BIMO_INPUT, error: 'Обе части должны иметь одинаковые размеры исходного холста. Экспортируйте их вместе, сохраняя прозрачные поля' })
      return
    }
    onChange({ ...EMPTY_BIMO_INPUT, checking: true })
    const timer = window.setTimeout(() => {
      void Promise.all(layers.map(async layer => ({ layer, ...await prepareImport(sources[layer]!.image, kind, fit, layer) }))).then(results => {
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
        let validationError = results.find(result => result.error)?.error ?? ''
        if (!validationError && kind === 'garment') {
          validationError = validateGarmentPair(results.find(result => result.layer === 'outfit')!.pixels, results.find(result => result.layer === 'sleeve')!.pixels) ?? ''
        }
        previews.current.push(urls)
        onChange({ files: validationError ? {} : files, art, error: validationError, checking: false })
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
        if (file) opened[layer] = { ...await loadImport(file, kind), filename: file.name }
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
  async function example() {
    const request = ++generation.current.value
    const controller = new AbortController()
    exampleRequest.current.controller = controller
    setLoading(true)
    setError('')
    onChange({ ...EMPTY_BIMO_INPUT, checking: true })
    try {
      const files: Partial<Record<BimoLayerName, File>> = {}
      for (const layer of layers) {
        const response = await fetch(`/bimo/items/hoodie-v4/${layer}.png`, { signal: controller.signal })
        if (!response.ok) throw new Error('Не удалось загрузить образец худи')
        files[layer] = new File([await response.blob()], `${layer}.png`, { type: 'image/png' })
      }
      if (generation.current.value === request && !controller.signal.aborted) await choose(files, true)
    } catch (reason) {
      if (!controller.signal.aborted) {
        const message = reason instanceof Error ? reason.message : 'Не удалось загрузить образец'
        setError(message)
        onChange({ ...EMPTY_BIMO_INPUT, error: message })
      }
    } finally { if (!controller.signal.aborted) setLoading(false) }
  }
  const width = kind === 'background' ? 600 : 512, height = kind === 'background' ? 500 : 512
  const hasSource = Object.keys(sources).length > 0
  return <div className="space-y-3">
    {layers.map(layer => <label key={layer} className="block text-sm font-semibold">{LAYER_LABELS[layer]}
      <input type="file" accept="image/png,image/webp" disabled={loading}
        className="mt-1.5 block w-full cursor-pointer rounded-lg border border-[var(--apex-border)] bg-[var(--apex-bg)] text-xs font-normal text-[var(--apex-text-secondary)] file:mr-3 file:cursor-pointer file:rounded-l-lg file:border-0 file:bg-[var(--apex-surface)] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[var(--apex-text)] disabled:opacity-60"
        onChange={event => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void choose({ [layer]: file })
        }} />
      {sources[layer] && <span className="mt-1 block break-all text-xs font-normal text-[var(--apex-text-secondary)]">{sources[layer]!.filename}</span>}
    </label>)}
    <p className="text-xs text-[var(--apex-text-secondary)]">{kind === 'background' ? 'PNG или WebP до 2 МБ. Фон кадрируется с сохранением пропорций.' : kind === 'garment' ? 'Два PNG или WebP до 2 МБ каждый на одинаковом прозрачном холсте. Основная часть включает левый рукав. Правый рукав подготовьте в положении опущенной лапы с запасом ткани у плеча.' : 'PNG или WebP до 2 МБ с прозрачным фоном. Только рисунок вещи.'}</p>
    {kind === 'garment' && <Button size="sm" disabled={loading} onClick={() => void example()}>Примерить эталонное худи</Button>}
    {loading && <p role="status" className="text-sm text-[var(--apex-text-secondary)]">Открываем рисунок…</p>}
    {error && <p role="alert" className="rounded-xl border border-[var(--apex-danger-light)] bg-[var(--apex-error-bg)] px-3 py-2 text-sm font-medium text-[var(--apex-error-text)]">{error}</p>}
    {hasSource && <>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Общая подгонка рисунка на Бимо" className="block w-full touch-none rounded-xl border border-[var(--apex-border)] bg-[var(--apex-bg)]"
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
      <p className="text-xs text-[var(--apex-text-secondary)]">{kind === 'garment' ? 'Посадка меняется сразу у обеих частей. Проверьте плечо и манжету в каждой реакции справа.' : 'Перетащите рисунок или используйте ползунки. Проверяйте посадку справа.'}</p>
      <div className="space-y-2 rounded-xl border border-[var(--apex-border)] p-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--apex-text-muted)]">Посадка</p>
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
