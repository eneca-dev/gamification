/**
 * Форматирует дату месяца лотереи: "апрель 2026"
 */
export function formatLotteryMonth(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
}

/**
 * Склоняет слово "раз": 1 раз, 2 раза, 5 раз
 */
export function declineRaz(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 14) return 'раз'
  if (mod10 === 1) return 'раз'
  if (mod10 >= 2 && mod10 <= 4) return 'раза'
  return 'раз'
}