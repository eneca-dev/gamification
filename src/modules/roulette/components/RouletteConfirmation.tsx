'use client'

import { useEffect, useRef } from 'react'
import { CoinStatic } from '@/components/CoinBalance'
import type { Confirmation } from '../types'

interface RouletteConfirmationProps {
  confirmation: Confirmation
  onConfirm: () => void
  onCancel: () => void
}
export function RouletteConfirmation({ confirmation, onConfirm, onCancel }: RouletteConfirmationProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    cancel.current?.focus()
    return () => element?.close()
  }, [])
  return (
    <dialog ref={dialog} onCancel={onCancel} aria-labelledby="roulette-confirm-title" aria-describedby="roulette-confirm-description"
      className="m-auto w-[calc(100%_-_2rem)] max-w-md rounded-2xl border border-[var(--apex-border)] bg-[var(--apex-surface)] p-6 text-[var(--apex-text)] backdrop:bg-[var(--apex-text)]/50">
      <h2 id="roulette-confirm-title" className="text-xl font-bold">Поставить весь баланс?</h2>
      <div id="roulette-confirm-description" className="my-4 space-y-3">
        <p>Ставка: <CoinStatic amount={confirmation.balance} />. Период: {confirmation.period} (Минск).</p>
        <p className="text-[var(--apex-danger)]">Два сектора из семи обнуляют баланс — вероятность 28,57%. Отменить выполненный ход нельзя.</p>
      </div>
      <div className="flex flex-wrap justify-end gap-3">
        <button ref={cancel} type="button" onClick={onCancel} className="rounded-xl border border-[var(--apex-border)] px-4 py-3">Отмена</button>
        <button type="button" onClick={onConfirm} className="rounded-xl bg-[var(--apex-primary)] px-4 py-3 text-[var(--apex-surface)] focus-visible:outline-2 focus-visible:outline-[var(--apex-focus)]">Подтверждаю ставку</button>
      </div>
    </dialog>
  )
}
