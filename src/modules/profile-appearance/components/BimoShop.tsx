'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/Button'
import { PurchaseButton } from '@/components/PurchaseButton'
import { useBalance } from '@/modules/shop/hooks/useBalance'
import { BimoStage, BimoStill, BIMO_SLOTS, DEFAULT_EQUIPMENT, bimoLook } from '@/modules/bimo-rig/index.client'
import type { BimoEquipment, BimoSlot } from '@/modules/bimo-rig'
import { useBimo, useBimoEquip, useBimoPurchase } from '../hooks'
import type { BimoState } from '../types'

const labels: Record<BimoSlot, string> = { outfit: 'Одежда', accessory: 'Аксессуары', background: 'Фоны' }
const defaults: Record<BimoSlot, string> = { outfit: 'Классический Бимо', accessory: 'Без аксессуара', background: 'Мятный фон' }
const CARD = 'card-hover flex flex-col overflow-hidden rounded-2xl border border-[var(--apex-border)] bg-[var(--apex-surface)]'
const MUTED = 'text-[11px] text-[var(--apex-text-muted)]'
// Лёгкий декор вокруг героя витрины: только на широких экранах, чтобы
// не спорить с текстом. Положение, размер и задержка покачивания у каждого свои.
const DECOR = [
  { symbol: '🍃', spot: 'left-[27%] top-1 text-3xl' },
  { symbol: '✨', spot: 'left-[21%] bottom-6 text-2xl' },
  { symbol: '☁️', spot: 'left-[33%] bottom-1 text-xl' },
  { symbol: '⭐', spot: 'right-[27%] top-2 text-2xl' },
  { symbol: '🐚', spot: 'right-[20%] bottom-7 text-3xl' },
  { symbol: '🌿', spot: 'right-[33%] bottom-1 text-xl' },
] as const

interface BimoShopProps {
  userId: string
  initialState: BimoState
  /** Баланс с сервера: первый кадр до того, как подтянется живой. */
  balance: number
}

export function BimoShop({ userId, initialState, balance }: BimoShopProps) {
  const router = useRouter()
  const query = useBimo(userId, { initialData: initialState, refetchOnWindowFocus: true })
  const balanceQuery = useBalance(userId, { initialData: balance })
  const purchase = useBimoPurchase()
  const equip = useBimoEquip()
  const [slot, setSlot] = useState<BimoSlot>('outfit')
  const [ownedOnly, setOwnedOnly] = useState(false)
  const [notice, setNotice] = useState('')
  const [previewEquipment, setPreviewEquipment] = useState<BimoEquipment | null>(null)
  const [pendingEquipment, setPendingEquipment] = useState<BimoEquipment | null>(null)

  const state = query.data ?? initialState
  const coins = balanceQuery.data ?? balance
  const localPreview = state.preview ? previewEquipment : null
  // Оптимистичный образ действует, пока запрос в полёте и пока подтягиваются
  // свежие данные. Дальше показывается серверное состояние, без эффектов.
  const optimistic = pendingEquipment && (equip.isPending || query.isFetching) ? pendingEquipment : null
  const equipment = localPreview ?? optimistic ?? state.equipment
  const busy = purchase.isPending || equip.isPending
  const items = state.items.filter(item => item.slot === slot && (!ownedOnly || item.owned))
  const defaultLook = bimoLook({ ...equipment, [slot]: null }, state.catalogArt)
  const look = bimoLook(query.isError ? DEFAULT_EQUIPMENT : equipment, state.catalogArt)
  const failure = purchase.error?.message || equip.error?.message || ''

  function tryOn(assetKey: string | null) {
    if (!state.preview) return
    setPreviewEquipment(previous => ({ ...(previous ?? equipment), [slot]: assetKey }))
  }

  async function apply(assetKey: string | null) {
    setNotice('')
    setPendingEquipment({ ...equipment, [slot]: assetKey })
    try {
      await equip.mutateAsync({ slot, assetKey })
      setPreviewEquipment(null)
      setNotice('Образ сохранён')
      router.refresh()
    } catch {
      // Откат: оптимистичный образ снимается, остаётся серверный.
      setPendingEquipment(null)
    }
  }

  async function buy(productId: string, price: number, comment?: string) {
    setNotice('')
    try {
      await purchase.mutateAsync({ productId, expectedPrice: price, comment })
      setPreviewEquipment(null)
      setNotice('Вещь добавлена в гардероб')
      router.refresh()
    } catch { /* Ошибка мутации показывается ниже. */ }
  }

  return (
    <section className="space-y-5" aria-label="Енот-Бимо">
      {/* Витрина от края сайдбара до края приложения: тон полосы — размытый фон
          надетого образа, поэтому полоса меняет цвет вместе с ним. Бимо выходит
          за верх полосы, поэтому у секции есть запас сверху. */}
      <div className="full-bleed relative mt-10 sm:mt-14">
        <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
          <div
            className="bimo-band-fade absolute inset-0 scale-110 bg-cover bg-center blur-2xl"
            style={{ backgroundImage: `url(${look.backgroundSrc})` }}
          />
          <div className="bimo-band-veil bimo-band-fade absolute inset-0" />
        </div>

        <div className="relative mx-auto grid max-w-[1200px] items-center gap-4 px-4 pb-6 pt-2 md:grid-cols-[1fr_auto_1fr] md:px-8 2xl:max-w-[1600px] 2xl:px-10 3xl:max-w-[2280px] ultrawide:max-w-[3160px]">
          {DECOR.map((item, index) => (
            <span
              key={item.symbol}
              aria-hidden="true"
              className={`bimo-decor stagger-${index + 1} pointer-events-none absolute hidden select-none opacity-70 lg:block ${item.spot}`}
            >
              {item.symbol}
            </span>
          ))}

          <div className="relative space-y-2 py-2">
            <h2 className="text-[30px] font-extrabold uppercase leading-[0.95] tracking-tight text-[var(--apex-text)] sm:text-[40px] lg:text-[46px]">
              Бимо шоп
            </h2>
            <p className="max-w-sm text-[15px] font-medium text-[var(--apex-text-secondary)]">Твой герой, твой стиль, твои достижения</p>
          </div>

          <div className="relative justify-self-center">
            <div aria-hidden="true" className="bimo-band-shadow absolute inset-x-6 bottom-2 h-6 blur-[2px]" />
            {/* Выход за верх полосы только с планшета: в одну колонку Бимо
                наехал бы на подзаголовок. */}
            <BimoStage {...look} interactive className="relative w-[230px] sm:w-[280px] md:-mt-12 lg:-mt-16 lg:w-[320px]" />
          </div>

          <div className="relative space-y-2 md:justify-self-end">
            <span className="inline-block rounded-full border border-[var(--apex-border)] bg-[var(--apex-surface)] px-3 py-1 text-[12px] font-bold uppercase tracking-wider text-[var(--apex-text-secondary)]">
              {localPreview ? 'Примерка без сохранения' : 'Текущий образ'}
            </span>
            <p className="max-w-xs text-[13px] text-[var(--apex-text-secondary)]">Один костюм, один аксессуар и один фон. Нажмите на Бимо, чтобы он показал реакцию.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" aria-label="Раздел гардероба">
        {BIMO_SLOTS.map(value => (
          <Button
            key={value}
            variant={slot === value ? 'primary' : 'secondary'}
            aria-pressed={slot === value}
            onClick={() => { setSlot(value); purchase.reset(); equip.reset(); setNotice('') }}
          >
            {labels[value]}
          </Button>
        ))}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={ownedOnly} onChange={event => setOwnedOnly(event.target.checked)} />
        Только мои вещи
      </label>

      {query.isError && (
        <div role="status" className="flex flex-wrap items-center gap-3 text-sm">
          <span>Не удалось обновить гардероб. Действия временно недоступны.</span>
          <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>Повторить</Button>
        </div>
      )}

      {failure && <p role="alert" className="rounded-xl border border-[var(--apex-danger-light)] bg-[var(--apex-error-bg)] px-3 py-2 text-sm font-medium text-[var(--apex-error-text)]">{failure}</p>}
      {!failure && notice && <p role="status" className="rounded-xl border border-[var(--apex-border)] bg-[var(--apex-bg)] px-3 py-2 text-sm font-medium text-[var(--apex-text-secondary)]">{notice}</p>}

      <div className="grid animate-fade-in-up grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        <article className={CARD}>
          <div className="flex h-32 w-full items-center justify-center">
            <BimoStill {...defaultLook} alt={defaults[slot]} className="h-full w-auto" />
          </div>
          <div className="flex flex-1 flex-col p-4 pt-8">
            <span className="mb-1 text-[11px] font-semibold text-[var(--apex-text-muted)]">{labels[slot]}</span>
            <h3 className="text-[13px] font-bold leading-snug text-[var(--apex-text)]">{defaults[slot]}</h3>
            <p className={`mb-2 mt-0.5 ${MUTED}`}>Доступно всем</p>
            <div className="mt-auto pt-2">
              <Button
                variant="primary"
                fullWidth
                disabled={busy || query.isError || equipment[slot] === null}
                onClick={() => void apply(null)}
              >
                {equipment[slot] === null ? 'Выбрано' : 'Выбрать'}
              </Button>
              <div className="mt-1 min-h-5">
                {state.preview && <button type="button" className="w-full text-[11px] font-medium text-[var(--apex-primary)] hover:underline" onClick={() => tryOn(null)}>Примерить</button>}
              </div>
            </div>
          </div>
        </article>

        {items.map(item => {
          const selected = equipment[slot] === item.assetKey
          // Отдельного магазинного изображения у вещей нет: карточка показывает
          // их на модели поверх текущего образа.
          const preview = item.supported ? bimoLook({ ...equipment, [slot]: item.assetKey }, state.catalogArt) : null
          const title = item.name.replace(/^Бимо · /, '')
          return (
            <article key={item.assetKey} className={CARD}>
              <div className={`relative flex h-32 w-full items-center justify-center overflow-hidden ${preview ? '' : 'bg-[var(--apex-emoji-bg)]'}`}>
                {preview
                  ? <BimoStill {...preview} alt={title} className="h-full w-auto" />
                  : <span aria-hidden="true" className="text-5xl">{item.emoji ?? '🦝'}</span>}
                {state.preview && !item.released && (
                  <span className="absolute left-3 top-3 rounded-lg bg-[var(--apex-warning-text)] px-2.5 py-1 text-[10px] font-bold text-white">Черновик</span>
                )}
              </div>
              <div className="flex flex-1 flex-col p-4 pt-8">
                <span className="mb-1 text-[11px] font-semibold text-[var(--apex-text-muted)]">{labels[slot]}</span>
                <h3 className="text-[13px] font-bold leading-snug text-[var(--apex-text)]">{title}</h3>
                <p className={`mb-2 mt-0.5 line-clamp-2 ${MUTED}`}>{item.description}</p>
                {!item.supported && <span className={`mb-2 ${MUTED}`}>Образ готовится</span>}
                <div className="mt-auto pt-2">
                  {item.owned ? (
                    <Button
                      variant="primary"
                      fullWidth
                      disabled={busy || query.isError || selected || !item.released || !item.supported}
                      onClick={() => void apply(item.assetKey)}
                    >
                      {selected ? 'Надето' : 'Надеть'}
                    </Button>
                  ) : (
                    <PurchaseButton
                      productId={item.productId}
                      productName={title}
                      price={item.price}
                      canAfford={coins >= item.price}
                      outOfStock={false}
                      comingSoon={!item.purchasable}
                      deficit={Math.max(0, item.price - coins)}
                      isPurchasing={busy}
                      commentRequired={item.commentRequired}
                      commentLabel={item.commentLabel}
                      commentPlaceholder={item.commentPlaceholder}
                      onPurchase={(productId, price, comment) => void buy(productId, price, comment)}
                    />
                  )}
                  <div className="mt-1 min-h-5">
                    {state.preview && item.supported && <button type="button" className="w-full text-[11px] font-medium text-[var(--apex-primary)] hover:underline" onClick={() => tryOn(item.assetKey)}>Примерить</button>}
                  </div>
                </div>
              </div>
            </article>
          )
        })}
      </div>

      {items.length === 0 && (
        <p className="text-sm text-[var(--apex-text-muted)]">
          {ownedOnly ? 'Купленных вещей в этом разделе пока нет. Базовый вариант доступен всегда.' : 'Коллекция этого раздела готовится.'}
        </p>
      )}
    </section>
  )
}
