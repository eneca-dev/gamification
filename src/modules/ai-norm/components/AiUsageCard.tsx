import { Info, type LucideIcon } from 'lucide-react'

interface AiUsageCardProps {
  title: string
  icon: LucideIcon
  month: string
  events: number | null
  dates: string[]
  eventLabel: string
  rule: string
  detail?: string
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
  title, icon: Icon, month, events, dates, eventLabel, rule, detail,
}: AiUsageCardProps) {
  const days = dates.length
  const completed = days > 0
  const progress = completed ? 100 : 0
  return (
    <section className="rounded-2xl p-4 sm:p-5 min-w-0" style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center" style={{ background: 'var(--apex-bg)' }}>
          <Icon size={17} style={{ color: 'var(--apex-primary)' }} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[14px] font-extrabold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
          <p className="text-[11px] capitalize" style={{ color: 'var(--text-secondary)' }}>{monthLabel(month)}</p>
        </div>
        <div className="group relative shrink-0">
          <button type="button" className="rounded-md p-1 focus-visible:outline-2 focus-visible:outline-offset-2" style={{ color: 'var(--text-muted)' }}
            aria-label={`Правило для «${title}»: ${rule}`} title={rule}>
            <Info size={16} aria-hidden="true" />
          </button>
          <div role="tooltip" className="pointer-events-none invisible absolute right-0 top-full z-20 mt-2 w-64 rounded-xl p-3 text-xs opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
            style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
            {rule}
            {detail && <span className="mt-1 block" style={{ color: 'var(--text-secondary)' }}>{detail}</span>}
          </div>
        </div>
      </div>
      {events === null ? (
        <p className="mt-5 text-sm" style={{ color: 'var(--text-secondary)' }}>Не удалось загрузить данные. Попробуйте обновить страницу позже.</p>
      ) : (
        <>
          <div className="mt-5 flex items-baseline justify-between gap-3">
            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Прогресс достижения</span>
            <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{completed ? 1 : 0}<span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}> / 1</span></span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--surface)' }}
            role="progressbar" aria-label={`Прогресс достижения ${title}`} aria-valuenow={completed ? 1 : 0} aria-valuemin={0} aria-valuemax={1}>
            <div className="h-full rounded-full" style={{ width: `${progress}%`, background: 'var(--apex-primary)' }} />
          </div>
          <p className="mt-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
            {events === 0 ? 'Данных за этот месяц пока нет' : `${eventLabel}: ${events} · дней использования: ${days}`}
          </p>
          {completed && <p className="mt-2 text-xs font-semibold" style={{ color: 'var(--apex-primary)' }}>Условие достижения выполнено</p>}
          {dates.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Даты использования">
              {dates.slice(0, 4).map((date) => (
                <time key={date} dateTime={date} className="rounded-md px-2 py-1 text-[11px] font-medium"
                  style={{ background: 'var(--apex-success-bg)', color: 'var(--apex-primary)' }}>
                  {dayLabel(date)}
                </time>
              ))}
              {dates.length > 4 && <span className="px-1 py-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>ещё {dates.length - 4}</span>}
            </div>
          )}
        </>
      )}
    </section>
  )
}
