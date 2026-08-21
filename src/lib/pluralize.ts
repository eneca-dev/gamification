/**
 * Склонение существительного после числительного по правилам русского языка.
 * forms — [1 форма, 2-4 форма, 5-20 форма], например ['запуск', 'запуска', 'запусков'].
 */
export function pluralizeRu(count: number, forms: [string, string, string]): string {
  const n = Math.abs(count) % 100
  const last = n % 10

  if (n >= 11 && n <= 14) return forms[2]
  if (last === 1) return forms[0]
  if (last >= 2 && last <= 4) return forms[1]
  return forms[2]
}
