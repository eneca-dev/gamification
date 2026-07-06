// Каталог категорий благодарностей — единый источник для модулей gratitudes и transactions.
// Категория отображается emoji + подписью везде, где встречается благодарность.
export const GRATITUDE_CATEGORIES = [
  { slug: 'help', label: 'Помощь и поддержка', emoji: '🤝' },
  { slug: 'quality', label: 'Профессионализм', emoji: '⭐' },
  { slug: 'mentoring', label: 'Наставничество', emoji: '📚' },
  { slug: 'teamwork', label: 'Командная работа', emoji: '🛡️' },
  { slug: 'atmosphere', label: 'Позитив и атмосфера', emoji: '☀️' },
  { slug: 'other', label: 'Другое', emoji: '💬' },
] as const

export type GratitudeCategorySlug = (typeof GRATITUDE_CATEGORIES)[number]['slug']

export function getCategoryEmoji(cat: string | null): string {
  return GRATITUDE_CATEGORIES.find((c) => c.slug === cat)?.emoji ?? '💬'
}

export function getCategoryLabel(cat: string | null): string {
  return GRATITUDE_CATEGORIES.find((c) => c.slug === cat)?.label ?? 'Другое'
}
