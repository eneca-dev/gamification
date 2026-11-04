import { Info } from 'lucide-react'

interface AiUsageCardProps {
  title: string
  month: string
  events: number | null
  dates: string[]
  eventLabel: string
  rule: string
}

function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString('ru-RU', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  })
}

function dayLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'short', timeZone: 'UTC',
  })
}

export function AiUsageCard({
  title, month, events, dates, eventLabel, rule,
}: AiUsageCardProps) {
  const days = dates.length
  const completed = days > 0
  const progress = completed ? 100 : 0
  return (
    <section className="min-w-0 rounded-2xl p-3 sm:p-4" style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="text-[14px] font-extrabold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
        <span className="text-[11px] capitalize" style={{ color: 'var(--text-secondary)' }}>{monthLabel(month)}</span>
        <div className="group relative ml-auto shrink-0">
          <button type="button" className="rounded-md p-1 focus-visible:outline-2 focus-visible:outline-offset-2" style={{ color: 'var(--text-muted)' }}
            aria-label={`Правило для «${title}»: ${rule}`} title={rule}>
            <Info size={16} aria-hidden="true" />
          </button>
          <div role="tooltip" className="pointer-events-none invisible absolute right-0 top-full z-20 mt-2 w-64 rounded-xl p-3 text-xs opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
            style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
            {rule}
          </div>
        </div>
      </div>
      {events === null ? (
        <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>Не удалось загрузить данные. Попробуйте обновить страницу позже.</p>
      ) : (
        <>
          <div className="mt-2 flex items-center gap-3">
            <span className="shrink-0 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Прогресс достижения</span>
            <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--surface)' }}
              role="progressbar" aria-label={`Прогресс достижения ${title}`} aria-valuenow={completed ? 1 : 0} aria-valuemin={0} aria-valuemax={1}>
              <div className="h-full rounded-full" style={{ width: `${progress}%`, background: 'var(--apex-primary)' }} />
            </div>
            <span className="shrink-0 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{completed ? 1 : 0}<span className="font-medium" style={{ color: 'var(--text-muted)' }}> / 1</span></span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <p style={{ color: 'var(--text-secondary)' }}>
              {events === 0 ? 'Данных за этот месяц пока нет' : `${eventLabel}: ${events} · дней использования: ${days}`}
            </p>
            {completed && <p className="font-semibold" style={{ color: 'var(--apex-primary)' }}>Условие достижения выполнено</p>}
            {dates.length > 0 && (
              <div className="flex flex-wrap gap-1" aria-label="Даты использования">
                {dates.slice(0, 4).map((date) => (
                  <time key={date} dateTime={date} className="rounded-md px-1.5 py-0.5 text-[11px] font-medium"
                    style={{ background: 'var(--apex-success-bg)', color: 'var(--apex-primary)' }}>
                    {dayLabel(date)}
                  </time>
                ))}
                {dates.length > 4 && <span className="px-1 py-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>ещё {dates.length - 4}</span>}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}
