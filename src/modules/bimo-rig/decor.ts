// Оформление вокруг Бимо: тон подложки и набор покачивающихся символов.
// Живёт в движке, потому что нужно обоим потребителям рендера —
// боковому меню и витрине гардероба.

/** Символы, подходящие любому фону, включая будущие. */
const NEUTRAL_SYMBOLS = ['✨', '💫'] as const
/** Бесплатный мятный фон товара не имеет, поэтому эмодзи задано здесь. */
const MINT_SYMBOL = '🍃'
const TINT_FALLBACK = 'var(--bimo-tint-mint)'
/** Больше шести символов не укладывается ни в одну раскладку. */
export const MAX_DECOR_SYMBOLS = 6
/**
 * Длиннее восьми знаков — это строка текста, а не эмодзи. Ограничение общее
 * для ввода админа, маршрута загрузки и чтения каталога: иначе один вход молча
 * отбрасывал бы символ, а другой отвечал отказом.
 */
export const MAX_DECOR_SYMBOL_LENGTH = 8

export type BimoDecorVariant = 'band' | 'preview' | 'sidebar'

/**
 * Набор админа из каталога: `jsonb` может содержать что угодно, поэтому
 * нестроки, пустые значения и лишнее за шестым символом отбрасываются здесь,
 * один раз на чтении.
 */
export function parseDecor(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const symbols: string[] = []
  for (const entry of value) {
    if (typeof entry !== 'string') continue
    const symbol = entry.trim()
    if (!symbol || symbol.length > MAX_DECOR_SYMBOL_LENGTH) continue
    symbols.push(symbol)
    if (symbols.length === MAX_DECOR_SYMBOLS) break
  }
  return symbols
}

/**
 * Символы фона: набор админа, а если он пуст — эмодзи товара фона из магазина
 * плюс нейтральные. Фон без товара и товар без эмодзи получают мятный символ.
 */
export function bimoDecor(symbols?: string[] | null, productEmoji?: string | null): string[] {
  if (symbols?.length) return symbols
  const lead = productEmoji?.trim()
  const symbol = lead && Array.from(lead).length <= 3 ? lead : MINT_SYMBOL
  return [symbol, ...NEUTRAL_SYMBOLS]
}

/**
 * Тон подложки под фон: токен `--bimo-tint-<ключ>` без таблицы соответствий.
 * Ключ приходит из каталога, поэтому подставляется только после проверки
 * формата — иначе в значение CSS попало бы произвольное содержимое.
 */
export function bimoTint(backgroundKey?: string | null): string {
  const slug = backgroundKey?.replace(/^background\./, '') ?? ''
  if (!/^[a-z][a-z0-9_]*$/.test(slug)) return TINT_FALLBACK
  return `var(--bimo-tint-${slug}, ${TINT_FALLBACK})`
}
