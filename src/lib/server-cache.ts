import { unstable_cache } from 'next/cache'

/** Время кэширования — 1 час */
export const CACHE_1H = 3600

/** Время кэширования — 30 минут */
export const CACHE_30M = 1800

/**
 * Обёртка над unstable_cache для удобного кэширования серверных запросов.
 * Автоматически создаёт cache key из тега и параметров.
 */
export function cached<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  keyParts: string[],
  options: { revalidate?: number; tags?: string[] } = {},
): (...args: TArgs) => Promise<TResult> {
  const { revalidate = CACHE_1H, tags = keyParts } = options
  return unstable_cache(fn, keyParts, { revalidate, tags })
}
