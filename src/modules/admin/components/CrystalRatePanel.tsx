'use client'

import { useState, useTransition } from 'react'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

import { CoinIcon } from '@/components/CoinIcon'
import { setCrystalRate } from '@/modules/shop/index.client'

interface CrystalRatePanelProps {
  currentRate: number
  previewRate: number | null
  onPreviewRateChange: (rate: number | null) => void
  onError: (error: string) => void
  onApplied: (rate: number) => void
}

export function CrystalRatePanel({
  currentRate,
  previewRate,
  onPreviewRateChange,
  onError,
  onApplied,
}: CrystalRatePanelProps) {
  const [draft, setDraft] = useState<string>(String(currentRate))
  const [isPending, startTransition] = useTransition()

  const draftNum = parseFloat(draft.replace(',', '.'))
  const draftValid = !isNaN(draftNum) && draftNum > 0
  const isPreviewing = previewRate !== null
  const draftDiffersFromCurrent = draftValid && draftNum !== currentRate

  function togglePreview() {
    if (isPreviewing) {
      onPreviewRateChange(null)
      return
    }
    if (!draftValid) {
      onError('Введите корректный курс')
      return
    }
    onPreviewRateChange(draftNum)
  }

  function handleApply() {
    if (!draftValid) {
      onError('Введите корректный курс')
      return
    }
    startTransition(async () => {
      const result = await setCrystalRate({ rate: draftNum })
      if (!result.success) {
        onError(result.error)
        return
      }
      onPreviewRateChange(null)
      onApplied(result.rate)
    })
  }

  return (
    <section
      className="rounded-2xl p-5"
      style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
    >
      <header className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[14px] font-bold" style={{ color: 'var(--apex-text)' }}>
            Курс кристаллов
          </h2>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--apex-text-secondary)' }}>
            1 BYN ={' '}
            <span className="font-semibold tabular-nums" style={{ color: 'var(--apex-text)' }}>
              {currentRate} <CoinIcon size={12} className="inline-block" />
            </span>
          </p>
        </div>
        {isPreviewing && (
          <span
            className="text-[11px] font-semibold px-2 py-1 rounded-md"
            style={{ background: 'var(--apex-warning-bg)', color: 'var(--apex-warning-text)' }}
          >
            Предпросмотр: {previewRate}
          </span>
        )}
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--apex-text-secondary)' }}>
            Новый курс (кристаллов за 1 BYN)
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-[13px] outline-none tabular-nums"
            style={{
              background: 'var(--apex-bg)',
              border: '1px solid var(--apex-border)',
              color: 'var(--apex-text)',
            }}
            placeholder="80"
          />
        </div>

        <button
          type="button"
          onClick={togglePreview}
          disabled={!draftValid && !isPreviewing}
          className="px-4 py-2 rounded-lg text-[13px] font-semibold flex items-center gap-2 transition-colors"
          style={{
            background: isPreviewing ? 'var(--apex-warning-bg)' : 'var(--apex-bg)',
            color: isPreviewing ? 'var(--apex-warning-text)' : 'var(--apex-text-secondary)',
            border: '1px solid var(--apex-border)',
            opacity: !draftValid && !isPreviewing ? 0.5 : 1,
          }}
        >
          {isPreviewing ? <EyeOff size={14} /> : <Eye size={14} />}
          {isPreviewing ? 'Выключить предпросмотр' : 'Предпросмотр'}
        </button>

        <button
          type="button"
          onClick={handleApply}
          disabled={isPending || !draftDiffersFromCurrent}
          className="px-4 py-2 rounded-lg text-[13px] font-semibold transition-colors"
          style={{
            background: 'var(--apex-primary)',
            color: 'white',
            opacity: isPending || !draftDiffersFromCurrent ? 0.6 : 1,
          }}
        >
          {isPending ? <Loader2 size={14} className="inline animate-spin" /> : 'Применить'}
        </button>
      </div>

      {isPreviewing && (
        <p className="text-[11px] mt-3" style={{ color: 'var(--apex-text-muted)' }}>
          В таблице товаров цены пересчитаны по предпросмотру. На пользователей это пока не влияет — нажмите «Применить», чтобы зафиксировать новый курс.
        </p>
      )}
    </section>
  )
}
