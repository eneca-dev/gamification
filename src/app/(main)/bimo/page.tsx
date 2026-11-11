import { redirect } from 'next/navigation'
import Link from 'next/link'

import { getCurrentUser } from '@/modules/auth'
import { bimoEnabled } from '@/modules/profile-appearance/queries'
import { getGalleryPage } from '@/modules/bimo-gallery'
import { BimoGalleryClient } from '@/modules/bimo-gallery/components/BimoGalleryClient'
import {
  DEFAULT_GALLERY_VIEW,
  GALLERY_GROUPINGS,
  GALLERY_LOOK_FILTERS,
  GALLERY_SORTS,
} from '@/modules/bimo-gallery'
import type { GalleryGrouping, GalleryLookFilter, GallerySort } from '@/modules/bimo-gallery'

interface BimoPageProps {
  searchParams: Promise<{ group?: string; sort?: string; look?: string }>
}

const pick = <T extends string>(allowed: readonly T[], value: string | undefined, fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback

export default async function BimoGalleryPage({ searchParams }: BimoPageProps) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  if (!bimoEnabled()) {
    return (
      <div
        className="rounded-2xl px-6 py-20 text-center"
        style={{ background: 'var(--apex-surface)', border: '1px solid var(--apex-border)' }}
      >
        <p className="text-[15px] font-semibold" style={{ color: 'var(--apex-text)' }}>
          Коллекция Бимо ещё не вышла
        </p>
        <p className="mt-2 text-[13px]" style={{ color: 'var(--apex-text-muted)' }}>
          Галерея и голосование откроются вместе с гардеробом.
        </p>
        <Link
          href="/store"
          className="mt-4 inline-block rounded-xl px-4 py-2 text-[13px] font-semibold"
          style={{ background: 'var(--apex-primary)', color: 'white' }}
        >
          В магазин
        </Link>
      </div>
    )
  }

  const params = await searchParams
  const page = await getGalleryPage(user.wsUserId)

  return (
    <BimoGalleryClient
      page={page}
      viewerId={user.wsUserId}
      initialView={{
        group: pick<GalleryGrouping>(GALLERY_GROUPINGS, params.group, DEFAULT_GALLERY_VIEW.group),
        sort: pick<GallerySort>(GALLERY_SORTS, params.sort, DEFAULT_GALLERY_VIEW.sort),
        look: pick<GalleryLookFilter>(GALLERY_LOOK_FILTERS, params.look, DEFAULT_GALLERY_VIEW.look),
      }}
    />
  )
}
