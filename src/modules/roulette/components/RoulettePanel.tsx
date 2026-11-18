'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Button } from '@/components/Button'
import { CoinIcon } from '@/components/CoinIcon'
import { CoinStatic } from '@/components/CoinBalance'
import { ActionError } from '@/modules/cache'
import { useBalance } from '@/modules/shop/hooks/useBalance'
import { usePrepareRoulette, useRecoverRoulette, useRouletteSpin, useRouletteState } from '../hooks'
import { clearPendingSpin, savePendingSpin, usePendingSpin } from '../pending'
import { SECTORS, SECTOR_LABELS, type Confirmation } from '../types'
import { RouletteWheel, sectorOutcome } from './RouletteWheel'

interface RoulettePanelProps { userId: string; isImpersonating: boolean }

/** Подписки нет: значение различается только между сервером и клиентом. */
const noSubscribe = () => () => {}

interface Crystal { size: number; spot: string; opacity: number }

/** Декор кристаллами. Позиции приходят снаружи, чтобы блоки не выглядели одинаково. */
function Crystals({ items }: { items: readonly Crystal[] }) {
  return (
    <>
      {items.map((crystal, index) => (
        <span
          key={crystal.spot}
          aria-hidden="true"
          className={`roulette-crystal stagger-${(index % 6) + 1} pointer-events-none absolute select-none ${crystal.spot}`}
          style={{ opacity: crystal.opacity }}
        >
          <CoinIcon size={crystal.size} />
        </span>
      ))}
    </>
  )
}

const HEADER_CRYSTALS: readonly Crystal[] = [
  { size: 26, spot: 'right-[18%] top-3', opacity: 0.3 },
  { size: 16, spot: 'right-[30%] bottom-4', opacity: 0.34 },
  { size: 20, spot: 'right-[8%] bottom-2', opacity: 0.26 },
]

/** Кристаллы на подложке колеса: только оформление, позиции заданы здесь. */
const STAGE_CRYSTALS: readonly Crystal[] = [
  { size: 26, spot: 'left-3 top-4', opacity: 0.38 },
  { size: 16, spot: 'left-8 top-24', opacity: 0.3 },
  { size: 20, spot: 'left-4 bottom-16', opacity: 0.32 },
  { size: 30, spot: 'right-3 top-8', opacity: 0.3 },
  { size: 14, spot: 'right-10 top-28', opacity: 0.4 },
  { size: 22, spot: 'right-5 bottom-20', opacity: 0.34 },
  { size: 18, spot: 'left-1/2 top-1 -translate-x-1/2', opacity: 0.26 },
  { size: 24, spot: 'left-1/3 bottom-3', opacity: 0.28 },
]

const CARD = 'rounded-xl border border-[var(--apex-border)] bg-[var(--apex-bg)] p-4'
const STEP = 'text-[11px] font-bold uppercase tracking-wider text-[var(--apex-text-muted)]'

/**
 * Сколько дней осталось до конца периода. Считается только на клиенте: состояние
 * рулетки приходит запросом, на сервере его нет, поэтому расхождений гидратации
 * не возникает.
 */
function daysLeftInPeriod(period: string): number {
  const [year, month] = period.split('-').map(Number)
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const minskToday = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Minsk' })).getDate()
  return Math.max(0, lastDay - minskToday)
}

export function RoulettePanel({ userId, isImpersonating }: RoulettePanelProps) {
  const state = useRouletteState(userId, { refetchInterval: 15000 })
  const balance = useBalance(userId)
  const prepare = usePrepareRoulette()
  const spin = useRouletteSpin()
  const recovery = useRecoverRoulette()
  const pending = usePendingSpin(userId)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [notice, setNotice] = useState('')
  const [revealedOperation, setRevealedOperation] = useState<string | null>(null)
  // На сервере баланса нет, а на клиенте он уже лежит в кэше: тот же ключ тянет
  // счётчик в сайдбаре. Первый клиентский рендер обязан совпасть с серверным,
  // иначе React ругается на несовпадение разметки.
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false)
  const sending = useRef(false)
  const cancelButton = useRef<HTMLButtonElement>(null)

  const requestedResult = recovery.submittedAt > spin.submittedAt
    ? recovery.data ?? spin.data?.result
    : spin.data?.result ?? recovery.data
  const result = requestedResult ?? state.data?.result ?? null
  const revealing = spin.isPending || Boolean(result && result.operationId !== revealedOperation)
  const currentUsed = Boolean(state.data?.result || (result && result.period === state.data?.period))
  const busy = prepare.isPending || spin.isPending || recovery.isPending
  const balanceReady = hydrated && balance.data !== undefined && !balance.isError && !balance.isFetching
  const stake = balanceReady ? balance.data! : null
  const mayStart = state.data?.enabled && !state.isError && !currentUsed && !pending
    && balanceReady && balance.data! > 0 && !isImpersonating && !busy

  // Фокус на безопасном действии: подтверждать нужно отдельным нажатием на колесе.
  useEffect(() => { if (confirmation) cancelButton.current?.focus() }, [confirmation])

  function send(value: Confirmation) {
    if (sending.current || isImpersonating) return
    try { savePendingSpin(userId, value) }
    catch { setNotice('Не удалось сохранить идентификатор хода в браузере. Запрос не отправлен. Разрешите хранилище сайта.'); return }
    sending.current = true
    setConfirmation(null)
    setNotice('')
    spin.mutate({ token: value.token }, {
      onSuccess: () => clearPendingSpin(userId, value),
      onError: error => {
        setNotice(error.message)
        if (error instanceof ActionError && ['roulette_balance_changed', 'roulette_period_changed', 'roulette_disabled', 'roulette_no_balance', 'roulette_numeric_limit'].includes(error.code ?? '')) {
          clearPendingSpin(userId, value)
        }
      },
      onSettled: () => { sending.current = false },
    })
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--apex-border)] bg-[var(--apex-surface)] text-[var(--apex-text)]" aria-labelledby="roulette-title" data-roulette-revealing={revealing ? 'true' : undefined}>
      <header className="roulette-stage relative flex flex-wrap items-start justify-between gap-3 overflow-hidden border-b border-[var(--apex-border)] p-4 sm:p-6">
        <Crystals items={HEADER_CRYSTALS} />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-block rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider" style={{ background: 'var(--tag-teal-bg)', color: 'var(--tag-teal-text)' }}>
              Один ход в месяц
            </span>
            <span className="text-[13px] font-bold" style={{ color: currentUsed ? 'var(--apex-text-muted)' : 'var(--apex-warning-text)' }}>
              {currentUsed ? 'Вы использовали свой ход' : 'Ход за этот месяц свободен'}
            </span>
          </div>
          <h2 id="roulette-title" className="mt-2 text-[22px] font-extrabold leading-tight sm:text-[26px]">Рулетка: испытай свою удачу!</h2>
          <p className="mt-1 text-sm text-[var(--apex-text-secondary)]">Ставка — весь положительный баланс. Месяц считается по времени Минска.</p>
        </div>
        {state.data && (
          <span className="relative rounded-xl border border-[var(--apex-border)] bg-[var(--apex-surface)] px-3 py-1.5 text-[12px] font-semibold text-[var(--apex-text-secondary)]">
            До конца месяца: {daysLeftInPeriod(state.data.period)} дн.
          </span>
        )}
      </header>

      <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="order-2 space-y-4 lg:order-1">
          <div className={CARD}>
            <p className={STEP}>Шаг 1 · Ставка</p>
            <p className="mt-1 min-h-7 text-sm">Текущий баланс: {revealing
              ? <span role="status">Ожидаем результат…</span>
              : balanceReady
                ? <span className="text-[20px]"><CoinStatic amount={balance.data!} size="md" /></span>
                : <span role="status">{balance.isError ? 'Не удалось обновить' : 'Обновляем…'}</span>}</p>
            <p className="mt-1 text-[12px] text-[var(--apex-text-muted)]">На кон идёт весь баланс целиком, выбрать сумму нельзя.</p>
            {balance.isError && <Button className="mt-2" onClick={() => void balance.refetch()}>Обновить баланс</Button>}
          </div>

          <div className={CARD}>
            <p className={STEP}>Шаг 2 · Что может выпасть</p>
            <ul className="mt-2 space-y-1.5 text-sm" aria-label="Исходы и вероятности">
              {SECTORS.map(sector => (
                <li key={sector} className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 font-bold">
                    {SECTOR_LABELS[sector]}{sector.startsWith('plus') && <CoinIcon size={14} />}
                  </span>
                  <span className="flex-1 border-b border-dashed border-[var(--apex-border)]" aria-hidden="true" />
                  <span className="text-[var(--apex-text-secondary)]">
                    {stake !== null && stake > 0 ? <>станет {sectorOutcome(sector, stake).toLocaleString('ru-RU')} · </> : null}1/7
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 rounded-lg bg-[var(--apex-error-bg)] px-3 py-2 text-[13px] font-semibold text-[var(--apex-error-text)]">
              Два сектора из семи обнуляют баланс — 28,57%. Вы рискуете всем балансом.
            </p>
          </div>

          {isImpersonating && <p role="alert" className="rounded-xl bg-[var(--apex-error-bg)] p-3 text-sm text-[var(--apex-error-text)]">Ходы при подмене пользователя запрещены.</p>}
          {state.isError && <div role="alert" className="text-sm">Не удалось проверить доступность рулетки. <button type="button" onClick={() => void state.refetch()} className="underline">Повторить проверку</button></div>}
          {state.isPending && <p role="status" className="text-sm text-[var(--apex-text-secondary)]">Проверяем доступность…</p>}
          {state.data && !state.data.enabled && <p className="text-sm">Рулетка временно выключена. Сохранённый результат можно восстановить.</p>}

          {pending && <div className="space-y-3 rounded-xl bg-[var(--apex-warning-bg)] p-3 text-sm" role="status">
            <p>Ход за {pending.period} отправлен. Его результат ещё нужно подтвердить; новый ход не запускается.</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" disabled={busy} onClick={() => recovery.mutate({ period: pending.period }, {
                onSuccess: data => {
                  if (data) { clearPendingSpin(userId, pending); setNotice('Результат восстановлен') }
                  else setNotice('Результат пока не найден. Запрос мог ещё выполняться. Повторять можно только этот же ход.')
                },
                onError: error => setNotice(error.message),
              })}>Восстановить результат</Button>
              <Button disabled={busy || isImpersonating} onClick={() => send(pending)}>Повторить прежний запрос</Button>
            </div>
          </div>}

          {/* Карточка появляется в момент отправки хода и дальше не исчезает:
              раньше она пропадала на время вращения и возвращалась, вёрстка
              прыгала трижды за ход. До первого хода её нет вовсе — пустой блок
              на свежей странице выглядел лишним. */}
          {/* Пока колесо крутится, фон нейтральный: цвет выдал бы исход заранее. */}
          {(result || spin.isPending) && <div
            role="status"
            className="min-h-[8.5rem] rounded-xl p-3 text-sm transition-colors duration-500"
            style={{ background: revealing || !result ? 'var(--apex-bg)' : result.sector.startsWith('zero') ? 'var(--apex-disabled-bg)' : 'var(--apex-success-bg)' }}
          >
            {result && !revealing && <>
              <p className="text-[15px] font-bold">Результат за {result.period}: {SECTOR_LABELS[result.sector]}</p>
              <p className="mt-1">Баланс сразу после того хода: <CoinStatic amount={result.balanceAfter} size="sm" />.</p>
              <p className="mt-1 text-[12px] text-[var(--apex-text-secondary)]">Актуальный баланс показан выше и может отличаться после покупок или начислений.</p>
              {currentUsed && <p className="mt-1 font-semibold">Ход использован. Следующий — с 1-го числа следующего месяца.</p>}
            </>}
          </div>}

          {!pending && !currentUsed && (confirmation
            ? <div className={`${CARD} space-y-2 border-[var(--apex-primary)]`} role="status">
                <p className={STEP}>Шаг 3 · Подтверждение</p>
                <p className="text-sm">Ставка: <CoinStatic amount={confirmation.balance} size="sm" />. Период: {confirmation.period} (Минск).</p>
                <p className="text-[13px] font-semibold text-[var(--apex-error-text)]">Два сектора из семи обнуляют баланс — вероятность 28,57%. Отменить выполненный ход нельзя.</p>
                <p className="text-sm font-bold">Нажмите «Крутить» в центре колеса →</p>
                <Button ref={cancelButton} onClick={() => setConfirmation(null)}>Отмена</Button>
              </div>
            : <div className={CARD}>
                <p className={STEP}>Шаг 3 · Ход</p>
                <Button
                  variant="primary"
                  fullWidth
                  className="mt-2 py-3 text-[14px]"
                  disabled={!mayStart}
                  onClick={() => {
                    setNotice('')
                    prepare.mutate(undefined, { onSuccess: setConfirmation, onError: error => { setNotice(error.message); void state.refetch() } })
                  }}
                >{prepare.isPending ? 'Готовим подтверждение…' : 'Поставить весь баланс'}</Button>
              </div>
          )}

          {busy && <p role="status" className="text-sm text-[var(--apex-text-secondary)]">Проверяем операцию…</p>}
          {notice && <p role="status" className="text-sm">{notice}</p>}
        </div>

        {/* Колесо вынесено на отдельную подложку: игровая часть визуально
            отделена от шагов, но остаётся в том же блоке. */}
        <div className="roulette-stage relative order-1 overflow-hidden rounded-2xl border border-[var(--apex-border)] p-4 sm:p-5 lg:order-2">
          <Crystals items={STAGE_CRYSTALS} />
          <RouletteWheel
            result={result}
            stake={stake}
            armed={Boolean(confirmation)}
            busy={spin.isPending}
            onSpin={confirmation ? () => send(confirmation) : undefined}
            onReveal={setRevealedOperation}
          />
          {/* Высота строки закреплена: во время вращения подписи нет, и без запаса
              колесо подпрыгивало бы в момент появления итога. */}
          <p className="relative mt-3 flex min-h-8 items-center justify-center text-center">
            {confirmation
              ? <span className="text-[13px] text-[var(--apex-text-secondary)]">Колесо готово. Нажмите «Крутить» в центре.</span>
              : revealing
                ? null
                : result
                  ? <span className={`roulette-outcome ${result.sector.startsWith('zero') ? 'roulette-outcome-zero' : 'roulette-outcome-win'}`}>
                      Выпало: {SECTOR_LABELS[result.sector]}
                    </span>
                  : <span className="text-[13px] text-[var(--apex-text-secondary)]">Семь равных секторов. Колесо оживёт после подтверждения ставки.</span>}
          </p>
        </div>
      </div>
    </section>
  )
}
