import { redirect } from 'next/navigation'

interface BimoPageProps {
  searchParams: Promise<{ group?: string; sort?: string; look?: string }>
}

/**
 * Галерея переехала во вкладку ленты компании. Адрес остаётся рабочим:
 * по нему расходились ссылки и закладки, фильтры переносятся как есть.
 */
export default async function BimoGalleryPage({ searchParams }: BimoPageProps) {
  const params = await searchParams
  const query = new URLSearchParams({ feed: 'bimo' })
  for (const key of ['group', 'sort', 'look'] as const) {
    const value = params[key]
    if (value) query.set(key, value)
  }
  redirect(`/activity?${query.toString()}`)
}
