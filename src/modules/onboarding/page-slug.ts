/** Маппинг pathname (+ опционально search) → pageSlug тура */
export const PAGE_SLUG_MAP: Record<string, string> = {
  '/': 'dashboard',
  '/achievements': 'achievements',
  '/store': 'store',
  '/activity': 'activity',
  '/transactions': 'transactions',
  '/admin': 'admin',
  '/admin/users': 'admin-users',
  '/admin/products': 'admin-products',
  '/admin/orders': 'admin-orders',
  '/admin/events': 'admin-events',
  '/admin/calendar': 'admin-calendar',
  '/admin/achievements': 'admin-achievements',
  // [LOTTERY HIDDEN] '/admin/lottery': 'admin-lottery',
  '/admin/help': 'admin-help',
  '/admin/day-off': 'admin-day-off',
  '/admin/economy': 'admin-economy',
  '/admin/feedback': 'admin-feedback',
  '/admin/chatbot': 'admin-chatbot',
  '/admin/shields': 'admin-shields',
  '/help': 'help',
}

/**
 * Динамические маршруты, где slug определяется по шаблону, а не точным
 * совпадением (редактор статьи справки: /admin/help/<slug>/edit и /admin/help/new/edit).
 */
const PAGE_SLUG_PATTERNS: { pattern: RegExp; slug: string }[] = [
  { pattern: /^\/admin\/help\/[^/]+\/edit$/, slug: 'admin-help-edit' },
]

/**
 * Обратный маппинг slug → path (с учётом search).
 * Нужен для программной навигации на нужную страницу перед запуском тура.
 */
export function getPathForSlug(slug: string): string | null {
  for (const [path, s] of Object.entries(PAGE_SLUG_MAP)) {
    if (s === slug) return path
  }
  return null
}

/**
 * Точное совпадение pathname (+ search) → slug.
 * Более специфичный ключ (с search) имеет приоритет над базовым pathname.
 */
export function getPageSlug(pathname: string, search?: string): string | null {
  if (search) {
    const full = `${pathname}${search}`
    if (PAGE_SLUG_MAP[full]) return PAGE_SLUG_MAP[full]
  }
  if (PAGE_SLUG_MAP[pathname]) return PAGE_SLUG_MAP[pathname]
  for (const { pattern, slug } of PAGE_SLUG_PATTERNS) {
    if (pattern.test(pathname)) return slug
  }
  return null
}

/**
 * Slug с учётом префиксного совпадения.
 * Нужен для ручного запуска тура на вложенных маршрутах,
 * например `/help/<article>` → `help`, `/admin/users/<id>` → `admin-users`.
 * Более длинные пути проверяются первыми, чтобы `/admin/users` не перехватывался `/admin`.
 */
export function getPageSlugWithFallback(pathname: string): string | null {
  if (PAGE_SLUG_MAP[pathname]) return PAGE_SLUG_MAP[pathname]

  for (const { pattern, slug } of PAGE_SLUG_PATTERNS) {
    if (pattern.test(pathname)) return slug
  }

  const sorted = Object.entries(PAGE_SLUG_MAP)
    .filter(([path]) => path !== '/')
    .sort(([a], [b]) => b.length - a.length)

  for (const [path, slug] of sorted) {
    if (pathname.startsWith(`${path}/`)) return slug
  }
  return null
}
