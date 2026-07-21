import type { ReactNode } from 'react'

// Карточка «эффекта вовлечения»: метрика группы до/после запуска с дельтой.
// Используется в блоках «Дисциплина Worksection» и «Запуски Revit-плагинов»
interface EffectCardProps {
  title: string
  before: number
  after: number
  hint: string
  accent: boolean
  tooltip?: ReactNode
}

function formatDelta(delta: number): string {
  const sign = delta > 0 ? '+' : ''
  return `${sign}${Math.round(delta * 10) / 10} пп`
}

export function EffectCard({ title, before, after, hint, accent, tooltip }: EffectCardProps) {
  const delta = Math.round((after - before) * 10) / 10
  const deltaColor = delta > 0 ? 'var(--apex-primary)' : delta < 0 ? 'var(--apex-danger)' : 'var(--apex-text-muted)'

  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-2"
      style={{
        background: accent ? 'rgba(var(--apex-primary-rgb), 0.06)' : 'var(--apex-surface)',
        border: accent ? '1px solid var(--apex-primary)' : '1px solid var(--apex-border)',
      }}
    >
      <span className="flex items-center gap-1 text-[12px] font-semibold" style={{ color: 'var(--apex-text)' }}>
        {title}
        {tooltip}
      </span>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-[26px] font-bold tabular-nums" style={{ color: 'var(--apex-text)' }}>
          {before}% → {after}%
        </span>
        <span className="text-[16px] font-bold tabular-nums" style={{ color: deltaColor }}>
          {formatDelta(delta)}
        </span>
      </div>
      <span className="text-[11px]" style={{ color: 'var(--apex-text-muted)' }}>
        {hint}
      </span>
    </div>
  )
}
