import Link from 'next/link'
import { ArrowLeft, Heart } from 'lucide-react'

import { getGratitudesFeedNew } from '@/modules/gratitudes'
import { CompanyGratitudeList } from '@/modules/gratitudes/components/CompanyGratitudeList'

export default async function AllGratitudesPage() {
  const gratitudes = await getGratitudesFeedNew(500)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-fade-in-up">
        <Link
          href="/activity"
          className="inline-flex items-center gap-1.5 text-[13px] font-bold mb-3 transition-opacity hover:opacity-70"
          style={{ color: 'var(--text-muted)' }}
        >
          <ArrowLeft size={14} />
          Лента компании
        </Link>
        <div className="flex items-center gap-2">
          <Heart size={20} style={{ color: 'var(--tag-purple-text)' }} />
          <h1 className="text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
            Все благодарности
          </h1>
        </div>
        <p className="text-sm font-medium mt-1" style={{ color: 'var(--text-secondary)' }}>
          Все благодарности по компании
        </p>
      </div>

      <div className="animate-fade-in-up stagger-1">
        <CompanyGratitudeList items={gratitudes} pageSize={30} />
      </div>
    </div>
  )
}
