'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { CoinIcon } from '@/components/CoinIcon'
import { BIMO_ACTIONS, BIMO_SHOP_PREVIEWS } from '../scenes'
import { BIMO_SLOTS, DEFAULT_EQUIPMENT, bimoLook, type BimoEquipment, type BimoSlot, type BimoState } from '../types'
import { useBimo, useBimoEquip, useBimoPurchase } from '../hooks'
import { BimoPortrait } from './BimoPortrait'

const labels: Record<BimoSlot, string> = { outfit: 'Одежда', accessory: 'Аксессуары', background: 'Фоны' }
const defaults: Record<BimoSlot, string> = { outfit: 'Классический Бимо', accessory: 'Без аксессуара', background: 'Мятный фон' }
const buttonClass = 'rounded-xl border border-[var(--apex-border)] px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-[var(--apex-focus)] disabled:cursor-not-allowed disabled:opacity-50'
const actionClass = 'w-full py-2.5 rounded-xl text-[12px] font-bold transition-all duration-200 bg-[var(--apex-primary)] text-white enabled:hover:bg-[var(--apex-primary-hover)] disabled:bg-[var(--apex-disabled-bg)] disabled:text-[var(--text-muted)] disabled:border disabled:border-[var(--border)] disabled:cursor-default focus-visible:outline-2 focus-visible:outline-[var(--apex-focus)]'
const defaultEmoji: Record<BimoSlot, string> = { outfit: '🦝', accessory: '✨', background: '🌿' }

export function BimoShop({ userId, initialState, balance }: { userId: string; initialState: BimoState; balance: number }) {
  const router = useRouter()
  const query = useBimo(userId, { initialData: initialState, refetchOnWindowFocus: true, refetchOnMount: 'always' })
  const purchase = useBimoPurchase()
  const equip = useBimoEquip()
  const [slot, setSlot] = useState<BimoSlot>('outfit')
  const [ownedOnly, setOwnedOnly] = useState(false)
  const [notice, setNotice] = useState('')
  const [previewEquipment, setPreviewEquipment] = useState<BimoEquipment | null>(null)
  const [actionIndex, setActionIndex] = useState(0)
  const state = query.data ?? initialState
  const localPreview = state.preview ? previewEquipment : null
  const busy = purchase.isPending || equip.isPending
  const items = state.items.filter(item => item.slot === slot && (!ownedOnly || item.owned))
  const defaultPreview = slot === 'outfit' ? BIMO_SHOP_PREVIEWS['outfit.classic']
    : slot === 'background' ? BIMO_SHOP_PREVIEWS['background.mint'] : undefined
  function tryOn(assetKey: string | null) {
    if (!state.preview) return
    setPreviewEquipment(previous => ({ ...(previous ?? state.equipment), [slot]: assetKey }))
  }
  async function apply(assetKey: string | null) {
    setNotice('')
    try { await equip.mutateAsync({ slot, assetKey }); setPreviewEquipment(null); setNotice('Образ сохранён'); router.refresh() }
    catch { /* The mutation error is rendered below. */ }
  }
  async function buy(productId: string) {
    setNotice('')
    try { await purchase.mutateAsync({ productId }); setPreviewEquipment(null); setNotice('Вещь добавлена в гардероб'); router.refresh() }
    catch { /* The mutation error is rendered below. */ }
  }
  return (
    <section className="space-y-5" aria-label="Енот-Бимо">
      <div className="flex flex-wrap items-center gap-5 rounded-2xl border border-[var(--apex-border)] bg-[var(--apex-surface)] p-4">
        <BimoPortrait {...bimoLook(query.isError ? DEFAULT_EQUIPMENT : localPreview ?? state.equipment)} actionIndex={actionIndex} />
        <div className="space-y-2"><h2 className="font-semibold">{localPreview ? 'Примерка без сохранения' : 'Текущий образ'}</h2><p className="max-w-md text-sm text-[var(--apex-text-muted)]">Можно надеть один костюм, один аксессуар и один фон. Нажмите на Бимо, чтобы посмотреть движение.</p>
          {state.preview && <label className="block text-sm">Проверить движение<select value={actionIndex} onChange={event => setActionIndex(Number(event.target.value))} className="ml-2 rounded-lg border border-[var(--apex-border)] bg-[var(--apex-surface)] p-2">{BIMO_ACTIONS.map((action, index) => <option key={action.id} value={index}>{action.name}</option>)}</select></label>}
          {localPreview && <button type="button" className={buttonClass} onClick={() => setPreviewEquipment(null)}>Вернуть текущий образ</button>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Раздел гардероба">{BIMO_SLOTS.map(value => <button type="button" key={value} aria-pressed={slot === value} className={`${buttonClass} ${slot === value ? 'bg-[var(--apex-primary)] text-white' : ''}`} onClick={() => { setSlot(value); purchase.reset(); equip.reset(); setNotice('') }}>{labels[value]}</button>)}</div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ownedOnly} onChange={event => setOwnedOnly(event.target.checked)} />Только мои вещи</label>
      {query.isError && <div role="status" className="flex flex-wrap items-center gap-3 text-sm"><span>Не удалось обновить гардероб. Действия временно недоступны.</span><button type="button" className={buttonClass} onClick={() => void query.refetch()}>Повторить</button></div>}
      {(notice || purchase.error || equip.error) && <p role="status" className="text-sm">{purchase.error?.message || equip.error?.message || notice}</p>}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 animate-fade-in-up stagger-3">
        <article className="rounded-2xl overflow-hidden card-hover flex flex-col stagger-1" style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}>
          <div className="h-32 w-full flex items-center justify-center" style={{ background: defaultPreview ? 'transparent' : 'var(--apex-emoji-bg)' }}>
            {defaultPreview ? <Image src={defaultPreview} alt={defaults[slot]} width={slot === 'background' ? 600 : 512} height={slot === 'background' ? 500 : 512} unoptimized className="w-full h-full object-contain" /> : <span aria-hidden="true" className="text-5xl">{defaultEmoji[slot]}</span>}
          </div>
          <div className="h-4" />
          <div className="p-4 flex flex-col flex-1">
            <span className="mb-1 text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>{labels[slot]}</span>
            <h3 className="text-[13px] font-bold leading-snug" style={{ color: 'var(--text-primary)' }}>{defaults[slot]}</h3>
            <p className="text-[11px] mt-0.5 mb-2" style={{ color: 'var(--text-muted)' }}>Доступно всем</p>
            <div className="mt-auto pt-2">
              <button type="button" className={actionClass} disabled={busy || query.isError || state.equipment[slot] === null} onClick={() => void apply(null)}>{state.equipment[slot] === null ? 'Выбрано' : 'Выбрать'}</button>
              <div className="min-h-5 mt-1">{state.preview && <button type="button" className="w-full text-[11px] font-medium text-[var(--apex-primary)] hover:underline" onClick={() => tryOn(null)}>Примерить</button>}</div>
            </div>
          </div>
        </article>
        {items.map((item, index) => {
          const selected = state.equipment[slot] === item.assetKey
          const preview = BIMO_SHOP_PREVIEWS[item.assetKey]
          return <article key={item.assetKey} className={`rounded-2xl overflow-hidden card-hover flex flex-col stagger-${Math.min(index + 2, 6)}`} style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', animationDelay: `${(index + 1) * 0.06}s` }}>
            <div className="h-32 w-full flex items-center justify-center relative overflow-hidden" style={{ background: preview ? 'transparent' : 'var(--apex-emoji-bg)' }}>
              {preview ? <Image src={preview} alt={item.name.replace(/^Бимо · /, '')} width={slot === 'background' ? 600 : 512} height={slot === 'background' ? 500 : 512} unoptimized className="w-full h-full object-contain" /> : <span aria-hidden="true" className="text-5xl">{item.emoji ?? '🦝'}</span>}
              {state.preview && !item.released && <span className="absolute top-3 left-3 text-[10px] font-bold px-2.5 py-1 rounded-lg" style={{ background: 'var(--apex-warning-text)', color: 'white' }}>Черновик</span>}
            </div>
            <div className="h-4" />
            <div className="p-4 flex flex-col flex-1">
              <span className="mb-1 text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>{labels[slot]}</span>
              <h3 className="text-[13px] font-bold leading-snug" style={{ color: 'var(--text-primary)' }}>{item.name.replace(/^Бимо · /, '')}</h3>
              <p className="text-[11px] mt-0.5 mb-2 line-clamp-2" style={{ color: 'var(--text-muted)' }}>{item.description}</p>
              {!item.supported && <span className="text-[11px] mb-2" style={{ color: 'var(--text-muted)' }}>Образ готовится</span>}
              <div className="mt-auto pt-2">
                {item.owned ? <button type="button" className={actionClass} disabled={busy || query.isError || selected || !item.released || !item.supported} onClick={() => void apply(item.assetKey)}>{selected ? 'Надето' : 'Надеть'}</button>
                  : <button type="button" className={actionClass} disabled={busy || query.isError || !item.purchasable || balance < item.price} onClick={() => void buy(item.productId)}>{item.purchasable ? <span className="inline-flex items-center gap-1">{item.price.toLocaleString('ru-RU')} <CoinIcon size={13} /></span> : 'Пока недоступно'}</button>}
                <div className="min-h-5 mt-1">
                  {state.preview && item.supported && <button type="button" className="w-full text-[11px] font-medium text-[var(--apex-primary)] hover:underline" onClick={() => tryOn(item.assetKey)}>Примерить</button>}
                  {!item.owned && item.purchasable && balance < item.price && <span className="flex items-center justify-center gap-0.5 text-[11px] font-medium whitespace-nowrap" style={{ color: 'var(--apex-danger)' }}>Не хватает {(item.price - balance).toLocaleString('ru-RU')}&nbsp;<CoinIcon size={10} /></span>}
                </div>
              </div>
            </div>
          </article>
        })}
      </div>
      {items.length === 0 && <p className="text-sm text-[var(--apex-text-muted)]">{ownedOnly ? 'Купленных вещей в этом разделе пока нет. Базовый вариант доступен всегда.' : 'Коллекция этого раздела готовится.'}</p>}
    </section>
  )
}
