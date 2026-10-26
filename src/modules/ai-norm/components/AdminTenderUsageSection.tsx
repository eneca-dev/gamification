import { getTenderMonthActivity, type TenderMonthActivity } from '../tender-queries'

const ACTION_NAMES: Record<string, string> = {
  app_init: 'Запуск приложения',
  'tender.view': 'Просмотр тендера',
  'tender.decision': 'Решение по тендеру',
  'tender.create_lead': 'Создание лида',
}

function ProjectPanel({ title, activity }: { title: string; activity: TenderMonthActivity | null }) {
  if (!activity) {
    return <section className="rounded-2xl border border-[var(--apex-border)] bg-[var(--apex-surface)] p-5">
      <h3 className="font-semibold text-[var(--apex-text)]">{title}</h3>
      <p className="mt-3 text-sm text-[var(--apex-text-secondary)]">Не удалось загрузить данные.</p>
    </section>
  }
  return (
    <section className="rounded-2xl border border-[var(--apex-border)] bg-[var(--apex-surface)] p-5">
      <h3 className="text-base font-semibold text-[var(--apex-text)]">{title}</h3>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Событий', activity.events],
          ['Сотрудников', activity.users],
          ['Условие выполнено', activity.qualifyingUsers],
          ['Без сопоставления', activity.unmatchedEvents],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-[var(--apex-border)] p-3">
            <div className="text-xl font-bold text-[var(--apex-text)]">{value}</div>
            <div className="text-xs text-[var(--apex-text-secondary)]">{label}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-[var(--apex-text-secondary)]">
        Последняя запись в Supabase: {activity.lastSyncedAt
          ? new Date(activity.lastSyncedAt).toLocaleString('ru-RU', { timeZone: 'Europe/Minsk' })
          : 'нет данных'}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {Object.entries(activity.actions).map(([action, count]) => (
          <span key={action} className="rounded-lg bg-[var(--apex-bg)] px-2.5 py-1 text-xs text-[var(--apex-text)]">
            {ACTION_NAMES[action] ?? action}: {count}
          </span>
        ))}
      </div>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-[var(--apex-text-muted)]">
            <tr><th className="pb-2 pr-3">Сотрудник</th><th className="pb-2 pr-3">Email</th><th className="pb-2 pr-3">Событий</th><th className="pb-2">Дней</th></tr>
          </thead>
          <tbody>
            {activity.people.map((person) => (
              <tr key={person.email} className="border-t border-[var(--apex-border)] text-[var(--apex-text)]">
                <td className="py-2 pr-3">{person.name}</td>
                <td className="py-2 pr-3">{person.email}</td>
                <td className="py-2 pr-3">{person.events}</td>
                <td className="py-2">{person.days}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {activity.unresolved.length > 0 && (
        <div className="mt-5">
          <h4 className="text-sm font-semibold text-[var(--apex-text)]">Пользователи без email</h4>
          <ul className="mt-2 space-y-1 text-xs text-[var(--apex-text-secondary)]">
            {activity.unresolved.map((item) => (
              <li key={item.sourceId}>ID {item.sourceId} · {item.name || 'Без имени'} · {item.status} · событий: {item.events}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

export async function AdminTenderUsageSection({ month }: { month: string }) {
  const [advisor, digest] = await Promise.all([
    getTenderMonthActivity('ai_tender_advisor_events', month).catch((error: unknown) => {
      console.error('Failed to load Tender Adviser admin activity', error)
      return null
    }),
    getTenderMonthActivity('ai_tender_digest_events', month).catch((error: unknown) => {
      console.error('Failed to load Tender Digest admin activity', error)
      return null
    }),
  ])
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-[var(--apex-text)]">Tender Adviser и Tender Digest · {month}</h2>
        <p className="mt-1 text-sm text-[var(--apex-text-secondary)]">
          Tender Adviser: запуск. Tender Digest: просмотр тендера, решение или создание лида.
          Одно использование за месяц выполняет условие достижения; начисления пока выключены.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <ProjectPanel title="Tender Adviser" activity={advisor} />
        <ProjectPanel title="Tender Digest" activity={digest} />
      </div>
    </section>
  )
}
