const MONTHS = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
] as const

/** `2026-11` → `ноябрь 2026`. Формат приходит из БД, поэтому разбираем строкой. */
export function monthLabel(month: string): string {
  const [year, index] = month.split('-')
  const name = MONTHS[Number(index) - 1]
  return name ? `${name} ${year}` : month
}

/** Сколько дней осталось до конца месяца конкурса, включая текущий. */
export function daysLeftInMonth(month: string): number {
  const [year, index] = month.split('-').map(Number)
  if (!year || !index) return 0
  const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Minsk' }))
  const lastDay = new Date(year, index, 0).getDate()
  const isSameMonth = today.getFullYear() === year && today.getMonth() + 1 === index
  return isSameMonth ? Math.max(1, lastDay - today.getDate() + 1) : 0
}
