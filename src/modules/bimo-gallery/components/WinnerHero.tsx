'use client'

import { Crown, Heart } from 'lucide-react'

import { BimoPortrait, DEFAULT_EQUIPMENT, bimoLook } from '@/modules/profile-appearance/index.client'

import { BimoThumb } from './BimoThumb'
import { monthLabel } from '../month'
import type { GalleryEntry, GalleryWinner } from '../types'

interface WinnerHeroProps {
  winners: GalleryWinner[]
  /** Образы берём из галереи: у победителя показывается его текущий образ. */
  entries: Map<string, GalleryEntry>
  lookLabels: Record<string, string>
}

/**
 * Итог прошлого месяца. Анимированный Canvas здесь один — у главного победителя;
 * зал славы и остальные делящие первое место рисуются статичными превью.
 */
export function WinnerHero({ winners, entries, lookLabels }: WinnerHeroProps) {
  if (winners.length === 0) return null

  const latestMonth = winners[0].contestMonth
  const latest = winners.filter((winner) => winner.contestMonth === latestMonth)
  const hallOfFame = winners.filter((winner) => winner.contestMonth !== latestMonth)
  const [main, ...shared] = latest
  const mainEquipment = entries.get(main.userId)?.equipment ?? DEFAULT_EQUIPMENT
  const look = [mainEquipment.outfit, mainEquipment.accessory, mainEquipment.background]
    .map((key) => (key ? lookLabels[key] ?? key : null))
    .filter((label): label is string => Boolean(label))

  return (
    <section
      className="rounded-2xl p-5"
      style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
    >
      <div
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase"
        style={{ background: 'var(--apex-warning-bg)', color: 'var(--apex-warning-dark)' }}
      >
        <Crown size={12} />
        Победитель · {monthLabel(latestMonth)}
      </div>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex-shrink-0">
          <BimoPortrait {...bimoLook(mainEquipment)} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-[18px] font-bold" style={{ color: 'var(--apex-text)' }}>{main.fullName}</div>
          <div className="text-[13px]" style={{ color: 'var(--apex-text-muted)' }}>{main.department ?? '—'}</div>
          <div className="mt-2 inline-flex items-center gap-1.5 text-[14px] font-bold" style={{ color: 'var(--apex-danger)' }}>
            <Heart size={15} fill="currentColor" />
            {main.likes}
          </div>
          <div className="mt-2 text-[12px]" style={{ color: 'var(--apex-text-secondary)' }}>
            {look.length > 0 ? `Образ: ${look.join(' · ')}` : 'Образ: базовый Бимо'}
          </div>

          {shared.length > 0 && (
            <div className="mt-3 text-[12px]" style={{ color: 'var(--apex-text-secondary)' }}>
              Первое место разделили: {shared.map((winner) => winner.fullName).join(', ')}
            </div>
          )}
        </div>
      </div>

      {hallOfFame.length > 0 && (
        <div className="mt-5 border-t pt-4" style={{ borderColor: 'var(--apex-border)' }}>
          <div className="mb-2 text-[11px] font-semibold uppercase" style={{ color: 'var(--apex-text-muted)' }}>
            Зал славы
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {hallOfFame.map((winner) => (
              <div key={`${winner.contestMonth}-${winner.userId}`} className="w-[96px] flex-shrink-0">
                <BimoThumb
                  look={bimoLook(entries.get(winner.userId)?.equipment ?? DEFAULT_EQUIPMENT)}
                  alt={`Бимо · ${winner.fullName}`}
                  className="rounded-lg"
                />
                <div className="mt-1 truncate text-[11px] font-semibold" style={{ color: 'var(--apex-text)' }}>
                  {winner.fullName}
                </div>
                <div className="truncate text-[10px]" style={{ color: 'var(--apex-text-muted)' }}>
                  {monthLabel(winner.contestMonth)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
