import { headers } from 'next/headers'

import type { MetadataRoute } from 'next'

/** Единственный домен, которому разрешена индексация, — боевое приложение. */
const INDEXABLE_HOST = 'gamification.eneca.by'

/**
 * Прод, дев и превью собираются из одного кода, различить их можно только
 * по домену запроса. Чтение заголовков переводит метаданные в динамический
 * режим: иначе ответ закешировался бы на сборке и был бы одинаковым везде.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const requestHeaders = await headers()
  const host = requestHeaders.get('host')?.split(':')[0].toLowerCase()

  if (host === INDEXABLE_HOST) {
    return { rules: { userAgent: '*', allow: '/' } }
  }

  return { rules: { userAgent: '*', disallow: '/' } }
}
