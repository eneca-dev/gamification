import Link from 'next/link'
import { FileCheck2 } from 'lucide-react'

import { getNormMonthActivity } from '@/modules/ai-norm/queries'

const MODE_LABELS: Record<string, string> = {
  spell_mistakes: 'Орфография',
  not_actual_by: 'Актуальность норм BY',
  not_actual_ru: 'Актуальность норм RU',
  not_actual_byru: 'Актуальность норм BY/RU',
  mode_stamps: 'Штампы',
  mode_pictext: 'Текст на изображениях',
  fonts_check: 'Шрифты',
  mode_borders: 'Рамки',
}

function adjacentMonth(month: string, offset: number): string {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Date(Date.UTC(year, monthNumber - 1 + offset, 1)).toISOString().slice(0, 7)
}

function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString('ru-RU', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  })
}

function dateLabel(date: string): string {
  const [year, month, day] = date.split('-')
  return `${day}.${month}.${year}`
}

export async function AdminNormControlSection({ month }: { month: string }) {
  const activity = await getNormMonthActivity(month).catch((error: unknown) => {
    console.error('Failed to load norm month activity', error)
    return null
  })

  const stats = activity ? [
    { label: 'Проверок по видам', value: activity.checks },
    { label: 'Сотрудников', value: activity.users },
    { label: 'Дней с проверками', value: activity.days },
    { label: 'Дней использования', value: activity.userDays },
  ] : []

  return (
    <section id="norm-control" className="space-y-5 scroll-mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileCheck2 size={20} className="text-[var(--apex-primary)]" />
          <h2 className="text-lg font-semibold text-[var(--apex-text)]">ИИ-нормоконтроль</h2>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link href={`/admin/achievements?normMonth=${adjacentMonth(month, -1)}#norm-control`} aria-label="Предыдущий месяц" className="text-[var(--apex-primary)]">←</Link>
          <span className="min-w-32 text-center font-medium text-[var(--apex-text)]">{monthLabel(month)}</span>
          <Link href={`/admin/achievements?normMonth=${adjacentMonth(month, 1)}#norm-control`} aria-label="Следующий месяц" className="text-[var(--apex-primary)]">→</Link>
        </div>
      </div>

      <p className="text-sm text-[var(--apex-text-secondary)]">
        Показаны проверки по видам: один документ может проверяться несколькими способами. Одна проверка за месяц выполняет условие достижения; начисления пока выключены.
      </p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-[var(--apex-border)] bg-[var(--apex-surface)] p-4">
            <div className="text-2xl font-semibold text-[var(--apex-text)]">{stat.value}</div>
            <div className="mt-1 text-xs text-[var(--apex-text-secondary)]">{stat.label}</div>
          </div>
        ))}
      </div>

      {!activity ? (
        <div className="rounded-2xl border border-[var(--apex-border)] bg-[var(--apex-surface)] p-8 text-center text-sm text-[var(--apex-text-secondary)]">
          Не удалось загрузить данные нормоконтроля. Обновите страницу позже.
        </div>
      ) : activity.checks === 0 ? (
        <div className="rounded-2xl border border-[var(--apex-border)] bg-[var(--apex-surface)] p-8 text-center text-sm text-[var(--apex-text-secondary)]">
          За выбранный месяц проверок пока нет.
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1fr_2fr]">
          <section className="rounded-2xl border border-[var(--apex-border)] bg-[var(--apex-surface)] p-5">
            <h3 className="mb-4 text-sm font-semibold text-[var(--apex-text)]">Виды проверок</h3>
            <div className="space-y-2 text-sm">
              {activity.modes.map((item) => (
                <div key={item.mode} className="flex justify-between gap-3 border-b border-[var(--apex-border)] pb-2 last:border-0">
                  <span className="text-[var(--apex-text-secondary)]">{MODE_LABELS[item.mode] ?? item.mode}</span>
                  <span className="font-semibold text-[var(--apex-text)]">{item.checks}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--apex-border)] bg-[var(--apex-surface)] p-5">
            <h3 className="mb-4 text-sm font-semibold text-[var(--apex-text)]">Сотрудники</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-[var(--apex-text-muted)]">
                  <tr><th className="pb-3 pr-3 font-medium">Имя</th><th className="pb-3 pr-3 font-medium">Проверок по видам</th><th className="pb-3 pr-3 font-medium">Дней</th><th className="pb-3 font-medium">Последняя</th></tr>
                </thead>
                <tbody>
                  {activity.people.map((person) => (
                    <tr key={person.email} className="border-t border-[var(--apex-border)] text-[var(--apex-text)]">
                      <td className="py-2.5 pr-3 font-medium">{person.name}</td>
                      <td className="py-2.5 pr-3">{person.checks}</td>
                      <td className="py-2.5 pr-3">{person.days}</td>
                      <td className="py-2.5 whitespace-nowrap">{dateLabel(person.lastDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}
