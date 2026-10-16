import { FileCheck2 } from 'lucide-react'

import type { NormPersonalActivity } from '../queries'

function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString('ru-RU', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  })
}

function dateLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', timeZone: 'UTC',
  })
}

export function PersonalNormActivity({ month, activity }: {
  month: string
  activity: NormPersonalActivity | null
}) {
  return (
    <section className="rounded-2xl p-5" style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileCheck2 size={19} style={{ color: 'var(--apex-primary)' }} aria-hidden="true" />
          <div>
            <h2 className="text-[16px] font-bold" style={{ color: 'var(--text-primary)' }}>Нормоконтроль</h2>
            <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
              Личная активность за {monthLabel(month)}
            </p>
          </div>
        </div>
        <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: 'var(--apex-bg)', color: 'var(--text-secondary)' }}>
          Демо · без начисления кристаллов
        </span>
      </div>

      {!activity ? (
        <p className="mt-5 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Не удалось загрузить данные нормоконтроля. Обновите страницу позже.
        </p>
      ) : activity.checks === 0 ? (
        <p className="mt-5 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Пока нет данных о проверках за этот месяц.
        </p>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:max-w-md">
            <div className="rounded-xl p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{activity.checks}</div>
              <div className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>Проверок по видам</div>
            </div>
            <div className="rounded-xl p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{activity.dates.length}</div>
              <div className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>Дней использования</div>
            </div>
          </div>
          <p className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
            Один документ может проверяться несколькими способами.
          </p>
          <h3 className="mt-5 mb-2 text-[12px] font-semibold" style={{ color: 'var(--text-secondary)' }}>Даты проверок</h3>
          <div className="flex flex-wrap gap-2">
            {activity.dates.map((date) => (
              <time key={date} dateTime={date} className="rounded-full px-3 py-1.5 text-[12px] font-medium" style={{ background: 'var(--apex-success-bg)', color: 'var(--apex-primary)' }}>
                {dateLabel(date)}
              </time>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
