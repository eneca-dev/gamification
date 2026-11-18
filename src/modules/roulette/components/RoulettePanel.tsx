'use client'

import { useRef, useState } from 'react'
import { CoinIcon } from '@/components/CoinIcon'
import { CoinStatic } from '@/components/CoinBalance'
import { ActionError } from '@/modules/cache'
import { useBalance } from '@/modules/shop/hooks/useBalance'
import { usePrepareRoulette, useRecoverRoulette, useRouletteSpin, useRouletteState } from '../hooks'
import { clearPendingSpin, savePendingSpin, usePendingSpin } from '../pending'
import { SECTORS, SECTOR_LABELS, type Confirmation } from '../types'
import { RouletteWheel } from './RouletteWheel'
import { RouletteConfirmation } from './RouletteConfirmation'

interface RoulettePanelProps { userId: string; isImpersonating: boolean }
const button = 'rounded-xl bg-[var(--apex-primary)] px-5 py-3 font-semibold text-[var(--apex-surface)] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-[var(--apex-focus)]'
export function RoulettePanel({ userId, isImpersonating }: RoulettePanelProps) {
  const state = useRouletteState(userId, { refetchInterval: 15000 })
  const balance = useBalance(userId)
  const prepare = usePrepareRoulette()
  const spin = useRouletteSpin()
  const recovery = useRecoverRoulette()
  const pending = usePendingSpin(userId)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [notice, setNotice] = useState('')
  const sending = useRef(false)
  const requestedResult = recovery.submittedAt > spin.submittedAt
    ? recovery.data ?? spin.data?.result
    : spin.data?.result ?? recovery.data
  const result = requestedResult ?? state.data?.result ?? null
  const currentUsed = Boolean(state.data?.result || (result && result.period === state.data?.period))
  const busy = prepare.isPending || spin.isPending || recovery.isPending
  const balanceReady = balance.data !== undefined && !balance.isError && !balance.isFetching
  const mayStart = state.data?.enabled && !state.isError && !currentUsed && !pending
    && balanceReady && balance.data! > 0 && !isImpersonating && !busy

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
    <section className="rounded-2xl border border-[var(--apex-border)] bg-[var(--apex-surface)] p-4 text-[var(--apex-text)] sm:p-6" aria-labelledby="roulette-title">
      <h2 id="roulette-title" className="text-xl font-bold">Рулетка</h2>
      <p className="mt-2 text-sm">Один ход в календарный месяц по времени Минска. Ставка — весь положительный баланс.</p>
      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <RouletteWheel result={result} />
        <div className="space-y-4">
          <p>Текущий баланс: {balanceReady ? <CoinStatic amount={balance.data!} /> : <span role="status">{balance.isError ? 'Не удалось обновить' : 'Обновляем…'}</span>}</p>
          {balance.isError && <button type="button" onClick={() => void balance.refetch()} className={button}>Обновить баланс</button>}
          <ul className="grid grid-cols-2 gap-2 text-sm" aria-label="Исходы и вероятности">
            {SECTORS.map(sector => <li key={sector} className="flex items-center gap-1 rounded-lg border border-[var(--apex-border)] p-2">
              {SECTOR_LABELS[sector]}{sector.startsWith('plus') && <CoinIcon size={16} />} — 1/7
            </li>)}
          </ul>
          <p className="rounded-xl bg-[var(--apex-error-bg)] p-3 text-sm text-[var(--apex-error-text)]">Вероятность обнуления — 2/7 (28,57%). Вы рискуете всем балансом.</p>
          {isImpersonating && <p role="alert">Ходы при подмене пользователя запрещены.</p>}
          {state.isError && <div role="alert">Не удалось проверить доступность рулетки. <button type="button" onClick={() => void state.refetch()} className="underline">Повторить проверку</button></div>}
          {state.isPending && <p role="status">Проверяем доступность…</p>}
          {state.data && !state.data.enabled && <p>Рулетка временно выключена. Сохранённый результат можно восстановить.</p>}
          {pending && <div className="space-y-3 rounded-xl bg-[var(--apex-warning-bg)] p-3" role="status">
            <p>Ход за {pending.period} отправлен. Его результат ещё нужно подтвердить; новый ход не запускается.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy} className={button} onClick={() => recovery.mutate({ period: pending.period }, {
                onSuccess: data => {
                  if (data) { clearPendingSpin(userId, pending); setNotice('Результат восстановлен') }
                  else setNotice('Результат пока не найден. Запрос мог ещё выполняться. Повторять можно только этот же ход.')
                },
                onError: error => setNotice(error.message),
              })}>Восстановить результат</button>
              <button type="button" disabled={busy || isImpersonating} className={button} onClick={() => send(pending)}>Повторить прежний запрос</button>
            </div>
          </div>}
          {result && <div role="status" className="rounded-xl bg-[var(--apex-success-bg)] p-3">
            <p className="font-bold">Результат за {result.period}: {SECTOR_LABELS[result.sector]}</p>
            <p>Баланс сразу после того хода: <CoinStatic amount={result.balanceAfter} />.</p>
            <p className="text-sm">Актуальный баланс показан выше и может отличаться после покупок или начислений.</p>
            {currentUsed && <p>Ход использован. Следующий — с 1-го числа следующего месяца.</p>}
          </div>}
          {!pending && !currentUsed && <button type="button" className={button} disabled={!mayStart} onClick={() => {
            setNotice('')
            prepare.mutate(undefined, { onSuccess: setConfirmation, onError: error => { setNotice(error.message); void state.refetch() } })
          }}>{prepare.isPending ? 'Готовим подтверждение…' : 'Поставить весь баланс'}</button>}
          {busy && <p role="status">Проверяем операцию…</p>}
          {notice && <p role="status">{notice}</p>}
        </div>
      </div>
      {confirmation && <RouletteConfirmation confirmation={confirmation} onCancel={() => setConfirmation(null)} onConfirm={() => send(confirmation)} />}
    </section>
  )
}
