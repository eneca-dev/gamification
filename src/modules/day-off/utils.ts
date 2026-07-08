export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day:   '2-digit',
    month: '2-digit',
    year:  'numeric',
  })
}

const MINSK_TIMEZONE = 'Europe/Minsk'
const CUTOFF_HOUR = 16
const CUTOFF_MINUTE = 30

export const DAY_OFF_CUTOFF_LABEL = '16:30'

function getMinskParts(now: Date): { dateStr: string; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: MINSK_TIMEZONE,
    year:     'numeric',
    month:    '2-digit',
    day:      '2-digit',
    hour:     '2-digit',
    minute:   '2-digit',
    hour12:   false,
  }).formatToParts(now)
  const map = Object.fromEntries(parts.map(p => [p.type, p.value]))
  return {
    dateStr: `${map.year}-${map.month}-${map.day}`,
    hour:    Number(map.hour),
    minute:  Number(map.minute),
  }
}

/** Крайний срок оформления заявки на сегодня — 16:30 по Минску, иначе HR не успеет её рассмотреть */
export function isSameDayCutoffPassed(now: Date = new Date()): boolean {
  const { hour, minute } = getMinskParts(now)
  return hour > CUTOFF_HOUR || (hour === CUTOFF_HOUR && minute >= CUTOFF_MINUTE)
}

/** Минимальная дата, доступная для выбора: сегодня (если до 16:30 по Минску) или завтра */
export function getMinDayOffDate(now: Date = new Date()): string {
  const { dateStr } = getMinskParts(now)
  if (!isSameDayCutoffPassed(now)) return dateStr
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
}

/** Валидация даты заявки: прошлое запрещено, сегодня — только до 16:30 по Минску */
export function getDayOffDateError(date: string, now: Date = new Date()): string | null {
  const { dateStr: todayStr } = getMinskParts(now)
  if (date < todayStr) return `Дата ${date} должна быть сегодня или в будущем`
  if (date === todayStr && isSameDayCutoffPassed(now)) {
    return `Сегодня заявку уже не оформить — приём заявок на сегодня заканчивается в ${DAY_OFF_CUTOFF_LABEL}, HR не успеет её рассмотреть`
  }
  return null
}
