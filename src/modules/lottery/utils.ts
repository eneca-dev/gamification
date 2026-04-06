/**
 * Форматирует дату месяца лотереи: "апрель 2026"
 */
export function formatLotteryMonth(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
}
