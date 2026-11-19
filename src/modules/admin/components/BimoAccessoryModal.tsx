'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/Button'
import { CoinStatic } from '@/components/CoinBalance'
import { computePriceCrystals } from '@/modules/shop/index.client'
import { CLASSIC_GARMENT } from '@/modules/bimo-rig'
import { createCacheMutation, queryKeys } from '@/modules/cache'
import { BimoStage, ITEM_LAYERS, LAYER_LABELS, REACTIONS } from '@/modules/bimo-rig/index.client'
import { BimoImportEditor, EMPTY_BIMO_INPUT } from './BimoImportEditor'
import type { PreparedBimoInput } from './BimoImportEditor'
import type { BimoArt, BimoItemKind, BimoReaction } from '@/modules/bimo-rig'

export interface CreatedBimoProduct {
  id: string; name: string; description: string | null; emoji: string | null
  cost_byn: number; coefficient: number; category_id: string; sort_order: number
  created_at: string; updated_at: string
  effect: string
}
interface BimoAccessoryModalProps {
  rate: number
  onCreated: (product: CreatedBimoProduct) => void
  artworkProduct?: { id: string; name: string; slot: ArtworkSlot }
  onUpdated?: () => void
  onClose: () => void
}
type SavedBimoProduct = Pick<CreatedBimoProduct, 'id' | 'created_at' | 'updated_at' | 'sort_order' | 'category_id' | 'effect'>
type ArtworkSlot = 'outfit' | 'background' | 'accessory'
interface ArtworkTarget { revision: string; art: BimoArt | null; slot: ArtworkSlot }
const ARTWORK_KINDS: Record<ArtworkSlot, BimoItemKind> = { outfit: 'garment', background: 'background', accessory: 'accessory' }
const ARTWORK_TITLES: Record<ArtworkSlot, string> = { outfit: 'Обновить одежду Бимо', background: 'Обновить фон Бимо', accessory: 'Обновить аксессуар Бимо' }
const useSaveBimoArtwork = createCacheMutation({
  mutationFn: async ({ body, method }: { body: FormData; method: 'POST' | 'PATCH' }) => {
    const response = await fetch('/api/admin/bimo-item', { method, body })
    if (response.redirected || response.status === 401 || response.status === 403) return { success: false as const, error: 'Сессия истекла или нет прав администратора. Обновите страницу' }
    const result = await response.json() as { success: false; error: string } | ({ success: true } & SavedBimoProduct)
    if (!result.success) return result
    return { success: true as const, data: result }
  },
  invalidateKeys: [queryKeys.bimo.all],
})
const KINDS: ReadonlyArray<readonly [BimoItemKind, string]> = [
  ['garment', 'Одежда'], ['accessory', 'Аксессуар на голову'], ['necklace', 'Аксессуар на шею'], ['background', 'Фон'],
]
const INPUT = 'mt-1 w-full rounded-lg border border-[var(--apex-border)] bg-[var(--apex-surface)] px-3 py-2 text-sm text-[var(--apex-text)] focus:outline-none focus:ring-2 focus:ring-[var(--apex-focus)] disabled:opacity-60'
const SECTION = 'text-[11px] font-bold uppercase tracking-wider text-[var(--apex-text-muted)]'
const ALERT = 'rounded-xl border border-[var(--apex-danger-light)] bg-[var(--apex-error-bg)] px-3 py-2 text-sm font-medium text-[var(--apex-error-text)]'
const LETTERS: Record<string, string> = { а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya' }
function slugify(name: string): string {
  return name.toLowerCase().replace(/^бимо\s*·\s*/, '').split('').map(char => LETTERS[char] ?? char).join('')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/^(\d)/, 'item_$1').slice(0, 40)
}
export function BimoAccessoryModal({ rate, onCreated, artworkProduct, onUpdated, onClose }: BimoAccessoryModalProps) {
  const id = useId(), dialog = useRef<HTMLDialogElement>(null)
  const [kind, setKind] = useState<BimoItemKind>(artworkProduct ? ARTWORK_KINDS[artworkProduct.slot] : 'garment')
  const [name, setName] = useState(''), [slug, setSlug] = useState<string | null>(null)
  const [description, setDescription] = useState(''), [emoji, setEmoji] = useState('')
  const [costByn, setCostByn] = useState('4.44'), [coefficient, setCoefficient] = useState('1')
  const [prepared, setPrepared] = useState<PreparedBimoInput>(EMPTY_BIMO_INPUT)
  const [error, setError] = useState('')
  const [target, setTarget] = useState<ArtworkTarget | null>(null)
  const [targetError, setTargetError] = useState('')
  const [targetRetry, setTargetRetry] = useState(0)
  const save = useSaveBimoArtwork()
  const pending = save.isPending
  const productId = artworkProduct?.id
  const targetSlot = artworkProduct?.slot
  const [paused, setPaused] = useState(false), [speed, setSpeed] = useState(1)
  const [playing, setPlaying] = useState(false)
  const [reaction, setReaction] = useState<{ id: BimoReaction; key: number } | null>(null)
  const [frame, setFrame] = useState<number | null>(null)
  const timeline = useRef<HTMLInputElement>(null), timeLabel = useRef<HTMLOutputElement>(null)
  const acceptPrepared = useCallback((value: PreparedBimoInput) => { setPrepared(previous => value.checking ? { ...previous, files: {}, error: '', checking: true } : value); setError('') }, [])
  const updateFrame = useCallback((time: number) => {
    if (timeline.current) timeline.current.value = String(time)
    if (timeLabel.current) timeLabel.current.value = `${(time / 1000).toFixed(2)} с`
  }, [])
  const effectiveSlug = slug ?? slugify(name)
  const layers = ITEM_LAYERS[kind]
  const availableKinds = artworkProduct ? KINDS.filter(([value]) => targetSlot === 'accessory' ? value === 'accessory' || value === 'necklace' : value === ARTWORK_KINDS[artworkProduct.slot]) : KINDS
  const complete = layers.every(layer => prepared.files[layer]) && !prepared.error && !prepared.checking && (!artworkProduct || Boolean(target))
  const price = computePriceCrystals(Number(costByn) || 0, Number(coefficient) || 0, rate, 0)
  const art = prepared.art ?? (target?.art?.[layers[0]] ? target.art : null)
  const duration = REACTIONS.find(item => item.id === (reaction?.id ?? 'crystal'))!.duration
  useEffect(() => {
    const previous = document.activeElement, element = dialog.current
    element?.showModal()
    return () => { element?.close(); if (previous instanceof HTMLElement) previous.focus() }
  }, [])
  useEffect(() => {
    if (!productId) return
    const controller = new AbortController()
    void fetch(`/api/admin/bimo-item?productId=${encodeURIComponent(productId)}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        if (response.redirected || response.status === 401 || response.status === 403) throw new Error('Сессия истекла или нет прав администратора')
        const result = await response.json() as { success: false; error: string } | ({ success: true } & ArtworkTarget)
        if (!result.success) throw new Error(result.error)
        if (result.slot !== targetSlot) throw new Error('Тип товара изменился. Закройте форму и откройте вещь заново')
        if (!controller.signal.aborted) {
          setKind(result.slot === 'accessory' && result.art?.neck ? 'necklace' : ARTWORK_KINDS[result.slot])
          setTarget(result)
        }
      }).catch(reason => {
        if (!controller.signal.aborted) setTargetError(reason instanceof Error ? reason.message : 'Не удалось загрузить выбранную вещь')
      })
    return () => controller.abort()
  }, [productId, targetRetry, targetSlot])
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (pending || !complete) return
    if (!artworkProduct && (name.trim().length < 2 || !/^[a-z][a-z0-9_]*$/.test(effectiveSlug))) { setError('Проверьте название и ключ вещи'); return }
    if (!artworkProduct && (!(Number(costByn) > 0) || !(Number(coefficient) > 0))) { setError('Себестоимость и коэффициент должны быть больше нуля'); return }
    setError('')
    try {
      const body = new FormData()
      body.append('fields', JSON.stringify(artworkProduct && target ? { productId: artworkProduct.id, revision: target.revision, kind } : { name: name.trim(), slug: effectiveSlug, description: description.trim() || null, emoji: emoji.trim() || null, costByn: Number(costByn), coefficient: Number(coefficient), kind }))
      for (const layer of layers) body.append(layer, prepared.files[layer]!)
      const result = await save.mutateAsync({ body, method: artworkProduct ? 'PATCH' : 'POST' })
      if (artworkProduct) { onUpdated?.(); return }
      onCreated({ id: result.id, name: name.trim(), description: description.trim() || null, emoji: emoji.trim() || null, cost_byn: Number(costByn), coefficient: Number(coefficient), category_id: result.category_id, sort_order: result.sort_order, created_at: result.created_at, updated_at: result.updated_at, effect: result.effect })
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось сохранить вещь. Проверьте соединение и повторите попытку') }
  }
  return <dialog ref={dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-help`}
    onCancel={event => { event.preventDefault(); if (!pending) onClose() }}
    onClick={event => { if (event.target === event.currentTarget && !pending) onClose() }}
    className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-5xl overflow-y-auto overscroll-contain rounded-2xl border border-[var(--apex-border)] bg-[var(--apex-surface)] p-0 text-[var(--apex-text)] backdrop:bg-[var(--apex-overlay)]">
    <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--apex-border)] bg-[var(--apex-surface)] px-5 py-4 sm:px-6">
      <div>
        <h2 id={`${id}-title`} className="text-[18px] font-bold leading-tight">{artworkProduct ? ARTWORK_TITLES[artworkProduct.slot] : 'Новая вещь для Бимо'}</h2>
        <p id={`${id}-help`} className="mt-1 text-[13px] text-[var(--apex-text-secondary)]">{artworkProduct?.name ?? 'Загрузите готовый рисунок, подгоните посадку и проверьте результат.'}</p>
      </div>
      <button type="button" aria-label="Закрыть" disabled={pending} onClick={onClose}
        className="-mr-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[var(--apex-text-muted)] transition-colors hover:bg-[var(--apex-bg)] hover:text-[var(--apex-text)] focus-visible:outline-2 focus-visible:outline-[var(--apex-focus)] disabled:opacity-50">
        <X size={18} />
      </button>
    </header>

    <form onSubmit={submit}>
      <fieldset disabled={pending} className="grid gap-6 px-5 py-5 sm:px-6 md:grid-cols-2">
        {/* На узком экране примерка идёт первой: посадку подгоняют, глядя на результат. */}
        <section className="order-1 space-y-3 md:order-2">
          <h3 className={SECTION}>Примерка на модели</h3>
          <div className="rounded-xl border border-[var(--apex-border)] bg-[var(--apex-bg)] p-3">
            <BimoStage garment={kind === 'garment' ? art : CLASSIC_GARMENT} accessory={kind === 'accessory' || kind === 'necklace' ? art : null} backgroundSrc={kind === 'background' ? art?.image ?? target?.art?.image : undefined} paused={paused} speed={speed} reaction={reaction} frame={frame} onPlayingChange={setPlaying} onFrameChange={updateFrame} className="w-full" idPrefix={`bimo-import-${id}`} />
            <p className="mt-2 text-center text-xs text-[var(--apex-text-secondary)]">{prepared.checking ? 'Подготавливаем рисунок…' : prepared.art ? 'Так вещь будет выглядеть после сохранения' : art ? 'Сохранённый рисунок вещи' : 'Загрузите рисунок для примерки'}</p>
          </div>

          <div className="space-y-3 rounded-xl border border-[var(--apex-border)] p-3">
            <p className={SECTION}>Проверка движения</p>
            <div className="flex flex-wrap gap-2">
              {REACTIONS.map(item => (
                <Button key={item.id} size="sm" disabled={playing && !paused}
                  onClick={() => { setReaction(previous => ({ id: item.id, key: (previous?.key ?? 0) + 1 })); setFrame(null); setPaused(false) }}>
                  {item.title}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? 'Продолжить' : 'Пауза'}</Button>
              <label className="flex items-center gap-2 text-xs text-[var(--apex-text-secondary)]">Скорость
                <select className={`${INPUT} w-auto py-1`} value={speed} onChange={event => setSpeed(Number(event.target.value))}>
                  <option value={1}>1×</option>
                  <option value={0.25}>0.25×</option>
                </select>
              </label>
            </div>
            <div>
              <label className="flex items-center justify-between text-xs text-[var(--apex-text-secondary)]">
                Положение реакции
                <output ref={timeLabel} className="tabular-nums">0.00 с</output>
              </label>
              <input ref={timeline} type="range" min={0} max={duration} step={1} defaultValue={0} className="mt-1 block w-full" onChange={event => { setFrame(Number(event.target.value)); setPaused(true) }} />
            </div>
            <p className="hidden text-xs text-[var(--apex-text-secondary)] motion-reduce:block">Включено уменьшение движения. Рассмотрите реакции с помощью ползунка.</p>
          </div>

          {prepared.error && <p role="alert" className={ALERT}>{prepared.error}</p>}
        </section>

        <section className={`order-2 space-y-4 md:order-1 ${pending ? 'pointer-events-none' : ''}`}>
          <h3 className={SECTION}>Рисунок и посадка</h3>
          {(!artworkProduct || target?.slot === 'accessory') && (
            <label className="block space-y-1 text-sm font-semibold">Тип вещи
              <select value={kind} className={INPUT} onChange={event => { setPrepared(EMPTY_BIMO_INPUT); setKind(event.target.value as BimoItemKind); setReaction(null); setFrame(null); setPaused(false); setError('') }}>
                {availableKinds.map(([value, title]) => <option key={value} value={value}>{title}</option>)}
              </select>
            </label>
          )}
          {artworkProduct && !target && !targetError && <p role="status" className="text-sm text-[var(--apex-text-secondary)]">Загружаем выбранную вещь…</p>}
          {targetError && (
            <div role="alert" className={`${ALERT} space-y-2`}>
              <p>{targetError}</p>
              <Button size="sm" onClick={() => { setTargetError(''); setTargetRetry(value => value + 1) }}>Повторить</Button>
            </div>
          )}
          {(!artworkProduct || target) && <>
            <div className="flex flex-wrap gap-3 text-xs">
              {layers.map(layer => <a key={layer} href={`/bimo/templates-v4/${layer}.png`} download className="text-[var(--apex-primary)] underline">Шаблон — {LAYER_LABELS[layer].toLowerCase()}</a>)}
            </div>
            <BimoImportEditor key={kind} kind={kind} onChange={acceptPrepared} />
          </>}
        </section>

        {!artworkProduct && (
          <section className="order-3 space-y-4 border-t border-[var(--apex-border)] pt-5 md:col-span-2">
            <h3 className={SECTION}>Товар в магазине</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block space-y-1 text-sm font-semibold">Название
                <input required minLength={2} maxLength={200} className={INPUT} value={name} onChange={event => setName(event.target.value)} placeholder="Бимо · Кремовое худи" />
              </label>
              <label className="block space-y-1 text-sm font-semibold">Ключ вещи
                <input required maxLength={40} pattern="[a-z][a-z0-9_]*" className={INPUT} value={effectiveSlug} onChange={event => setSlug(event.target.value)} />
              </label>
            </div>
            <label className="block space-y-1 text-sm">Описание
              <textarea maxLength={1000} rows={2} className={INPUT} value={description} onChange={event => setDescription(event.target.value)} />
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1 text-sm">Эмодзи<input maxLength={10} className={INPUT} value={emoji} onChange={event => setEmoji(event.target.value)} /></label>
              <label className="space-y-1 text-sm">Себестоимость, BYN<input required type="number" min="0.01" step="0.01" className={INPUT} value={costByn} onChange={event => setCostByn(event.target.value)} /></label>
              <label className="space-y-1 text-sm">Коэффициент<input required type="number" min="0.01" step="0.01" className={INPUT} value={coefficient} onChange={event => setCoefficient(event.target.value)} /></label>
            </div>
            <p className="flex items-center gap-2 text-sm font-semibold">Цена для покупателя: <CoinStatic amount={price} size="sm" /></p>
          </section>
        )}
      </fieldset>

      <footer className="sticky bottom-0 space-y-3 border-t border-[var(--apex-border)] bg-[var(--apex-surface)] px-5 py-4 sm:px-6">
        <p className="text-[13px] text-[var(--apex-text-secondary)]">{artworkProduct ? 'Подготовленный рисунок заменит графику выбранного черновика.' : 'Вещь сохранится черновиком. Выпуск для покупателей выполняется отдельно в списке товаров.'}</p>
        {error && <p role="alert" className={ALERT}>{error}</p>}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" variant="primary" disabled={pending || !complete}>
            {pending ? 'Сохраняем…' : prepared.checking ? 'Проверяем…' : artworkProduct ? 'Обновить графику' : 'Сохранить черновик'}
          </Button>
          <Button disabled={pending} onClick={onClose}>Отмена</Button>
        </div>
      </footer>
    </form>
  </dialog>
}
