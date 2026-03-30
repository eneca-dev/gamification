import Link from 'next/link'
import { ArrowLeft, Trophy } from 'lucide-react'

import { getCompanyAwards } from '@/modules/achievements'
import { CompanyAwardCard } from '@/modules/achievements/components/CompanyAwardCard'
import { AwardsFilters } from '@/modules/achievements/components/AwardsFilters'

export default async function AllAchievementsPage() {
  const awards = await getCompanyAwards()

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
          <Trophy size={20} style={{ color: 'var(--orange-500)' }} />
          <h1 className="text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
            Все достижения
          </h1>
        </div>
        <p className="text-sm font-medium mt-1" style={{ color: 'var(--text-secondary)' }}>
          История достижений по всей компании
        </p>
      </div>

      <AwardsFilters awards={awards} />
    </div>
  )
}
