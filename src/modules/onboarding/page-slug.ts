/** Маппинг pathname → pageSlug тура */
export const PAGE_SLUG_MAP: Record<string, string> = {
  '/': 'dashboard',
  '/achievements': 'achievements',
  '/store': 'store',
  '/activity': 'activity',
  '/admin': 'admin',
  '/admin/users': 'admin-users',
  '/admin/products': 'admin-products',
  '/admin/orders': 'admin-orders',
  '/admin/events': 'admin-events',
  '/admin/calendar': 'admin-calendar',
  '/admin/achievements': 'admin-achievements',
  '/admin/lottery': 'admin-lottery',
  '/admin/help': 'admin-help',
  '/help': 'help',
  '/master-planner': 'master-planner',
}

/** Точное совпадение pathname → slug. Используется для автозапуска. */
export function getPageSlug(pathname: string): string | null {
  return PAGE_SLUG_MAP[pathname] ?? null
}

/**
 * Slug с учётом префиксного совпадения.
 * Нужен для ручного запуска тура на вложенных маршрутах,
 * например `/help/<article>` → `help`, `/admin/users/<id>` → `admin-users`.
 * Более длинные пути проверяются первыми, чтобы `/admin/users` не перехватывался `/admin`.
 */
export function getPageSlugWithFallback(pathname: string): string | null {
  if (PAGE_SLUG_MAP[pathname]) return PAGE_SLUG_MAP[pathname]

  const sorted = Object.entries(PAGE_SLUG_MAP)
    .filter(([path]) => path !== '/')
    .sort(([a], [b]) => b.length - a.length)

  for (const [path, slug] of sorted) {
    if (pathname.startsWith(`${path}/`)) return slug
  }
  return null
}
