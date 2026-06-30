'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { Eye, EyeOff, Loader2, X } from 'lucide-react'

import { CoinIcon } from '@/components/CoinIcon'
import { setCrystalRate } from '@/modules/shop/index.client'
import type { CrystalRateRow } from '@/modules/admin'

interface CrystalRateEditing {
  previewRate: number | null
  onPreviewRateChange: (rate: number | null) => void
  onError: (error: string) => void
  onApplied: (rate: number) => void
}

interface CrystalRateHistoryProps {
  rates: CrystalRateRow[]
  // Если передан — карточка становится редактируемой (смена курса + предпросмотр товаров)
  editing?: CrystalRateEditing
  // Доп. колонка справа (например, статистика) — занимает оставшееся место
  extra?: ReactNode
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function CrystalRateHistory({ rates, editing, extra }: CrystalRateHistoryProps) {
  const compact = !!editing || !!extra
  const current = rates[0] ?? null
  const history = rates.slice(1)
  const currentRate = current?.rate ?? 80

  const [draft, setDraft] = useState<string>(String(currentRate))
  const [isPending, startTransition] = useTransition()

  const draftNum = parseFloat(draft.replace(',', '.'))
  const draftValid = !isNaN(draftNum) && draftNum > 0
  const previewRate = editing?.previewRate ?? null
  const isPreviewing = previewRate !== null
  const draftDiffersFromCurrent = draftValid && draftNum !== currentRate

  function togglePreview() {
    if (!editing) return
    if (isPreviewing) {
      editing.onPreviewRateChange(null)
      return
    }
    if (!draftValid) {
      editing.onError('Введите корректный курс')
      return
    }
    editing.onPreviewRateChange(draftNum)
  }

  function handleApply() {
    if (!editing) return
    if (!draftValid) {
      editing.onError('Введите корректный курс')
      return
    }
    startTransition(async () => {
      const result = await setCrystalRate({ rate: draftNum })
      if (!result.success) {
        editing.onError(result.error)
        return
      }
      editing.onPreviewRateChange(null)
      editing.onApplied(result.rate)
    })
  }

  // Нечего показывать и нечего редактировать
  if (rates.length === 0 && !editing) return null

  return (
    <section className="space-y-2" data-onboarding="admin-economy-rate">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-bold" style={{ color: 'var(--apex-text)' }}>
          Курс кристаллов
        </h2>
        {isPreviewing && (
          <span
            className="text-[11px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1.5"
            style={{ background: 'var(--apex-warning-bg)', color: 'var(--apex-warning-text)' }}
          >
            Предпросмотр: {previewRate}
            <button
              type="button"
              onClick={() => editing?.onPreviewRateChange(null)}
              className="-mr-0.5 rounded-full p-0.5 transition-colors hover:bg-[var(--apex-warning-muted)]"
              aria-label="Сбросить предпросмотр"
              title="Сбросить предпросмотр"
            >
              <X size={12} />
            </button>
          </span>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-2 items-stretch">
      {/* Блок 1: текущий курс + история */}
      {(current || history.length > 0) && (
        <div
          className={`rounded-xl px-4 py-3 flex flex-col gap-3 min-w-0 ${compact ? 'lg:w-[260px] lg:shrink-0' : 'lg:flex-1'}`}
          data-onboarding="admin-rate-current"
          style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
        >
          {current && (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[18px] font-bold tabular-nums leading-none" style={{ color: 'var(--apex-text)' }}>
                  {current.rate}
                </span>
                <CoinIcon size={14} />
                <span className="text-[12px] font-medium" style={{ color: 'var(--apex-text-secondary)' }}>
                  = 1 BYN
                </span>
              </div>
              <div className="text-right leading-tight">
                <div className="text-[11px]" style={{ color: 'var(--apex-text-secondary)' }}>
                  {formatDate(current.created_at)}
                </div>
                {current.set_by && (
                  <div className="text-[11px]" style={{ color: 'var(--apex-text-muted)' }}>
                    {current.set_by}
                  </div>
                )}
              </div>
            </div>
          )}

          {history.length > 0 && (
            <div
              className="flex flex-col gap-1.5"
              style={current ? { borderTop: '1px solid var(--apex-border)', paddingTop: '12px' } : undefined}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--apex-text-muted)' }}>
                История
              </span>
              {history.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between text-[12px]"
                  style={{ color: 'var(--apex-text-secondary)' }}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="tabular-nums font-medium" style={{ color: 'var(--apex-text)' }}>
                      {row.rate}
                    </span>
                    <CoinIcon size={11} />
                    <span>= 1 BYN</span>
                  </div>
                  <div className="text-right leading-tight">
                    <div>{formatDate(row.created_at)}</div>
                    {row.set_by && (
                      <div style={{ color: 'var(--apex-text-muted)' }}>
                        {row.set_by}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Блок 2: установка нового курса + предпросмотр */}
      {editing && (
        <div
          className="rounded-xl px-4 py-3 lg:w-[320px] shrink-0"
          data-onboarding="admin-rate-new"
          style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
        >
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[160px]">
              <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--apex-text-secondary)' }}>
                Новый курс (кристаллов за 1 BYN)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg text-[13px] outline-none tabular-nums"
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
              className="px-3 py-1.5 rounded-lg text-[12px] font-semibold flex items-center gap-1.5 transition-colors"
              style={{
                background: isPreviewing ? 'var(--apex-warning-bg)' : 'var(--apex-bg)',
                color: isPreviewing ? 'var(--apex-warning-text)' : 'var(--apex-text-secondary)',
                border: '1px solid var(--apex-border)',
                opacity: !draftValid && !isPreviewing ? 0.5 : 1,
              }}
            >
              {isPreviewing ? <EyeOff size={13} /> : <Eye size={13} />}
              {isPreviewing ? 'Выключить предпросмотр' : 'Предпросмотр'}
            </button>

            <button
              type="button"
              onClick={handleApply}
              disabled={isPending || !draftDiffersFromCurrent}
              className="px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors"
              style={{
                background: 'var(--apex-primary)',
                color: 'white',
                opacity: isPending || !draftDiffersFromCurrent ? 0.6 : 1,
              }}
            >
              {isPending ? <Loader2 size={13} className="inline animate-spin" /> : 'Применить'}
            </button>
          </div>

          {isPreviewing && (
            <p className="text-[11px] mt-2" style={{ color: 'var(--apex-text-muted)' }}>
              Цены в таблице пересчитаны по предпросмотру. На пользователей пока не влияет — нажмите «Применить».
            </p>
          )}
        </div>
      )}

      {/* Блок 3: доп. статистика */}
      {extra}
      </div>
    </section>
  )
}
