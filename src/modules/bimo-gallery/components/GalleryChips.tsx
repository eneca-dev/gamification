'use client'

interface GalleryChipsProps {
  label: string
  value: string
  options: [value: string, text: string][]
  onChange: (value: string) => void
}

/** Ряд переключателей с подписью: «Группировка» → Отделы · Команды · Без групп. */
export function GalleryChips({ label, value, options, onChange }: GalleryChipsProps) {
  return (
    <div className="flex flex-col gap-1" role="group" aria-label={label}>
      <span
        className="px-1 text-[10px] font-semibold uppercase tracking-wide"
        style={{ color: 'var(--apex-text-muted)' }}
      >
        {label}
      </span>
      <div className="flex items-center gap-1">
        {options.map(([key, text]) => {
          const active = key === value
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              aria-pressed={active}
              className="rounded-xl px-3 py-2 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-[var(--apex-focus)]"
              style={{
                background: active ? 'var(--apex-primary)' : 'var(--apex-surface)',
                color: active ? 'white' : 'var(--apex-text-secondary)',
                border: active ? '1px solid transparent' : '1px solid var(--apex-border)',
              }}
            >
              {text}
            </button>
          )
        })}
      </div>
    </div>
  )
}
