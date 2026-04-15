import Link from 'next/link'
import { Trophy, Heart, ChevronRight } from 'lucide-react'

import { getCompanyAwards } from '@/modules/achievements'
import { getCompanyGratitudes } from '@/modules/gratitudes'
import { AwardsFilters } from '@/modules/achievements/components/AwardsFilters'
import { CompanyGratitudeList } from '@/modules/gratitudes/components/CompanyGratitudeList'

function getCurrentMonthRange(): { start: string; end: string; label: string } {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const start = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const lastDay = new Date(year, month + 1, 0).getDate()
  const end = `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`
  const label = now.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
  return { start, end, label }
}

function getTwoWeeksAgoISO(): string {
  const d = new Date()
  d.setDate(d.getDate() - 14)
  return d.toISOString()
}

export default async function ActivityPage() {
  const monthRange = getCurrentMonthRange()

  const [awards, gratitudes] = await Promise.all([
    getCompanyAwards(monthRange.start, monthRange.end),
    getCompanyGratitudes(getTwoWeeksAgoISO(), 100),
  ])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-fade-in-up">
        <h1 className="text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
          Лента компании
        </h1>
        <p className="text-sm font-medium mt-1" style={{ color: 'var(--text-secondary)' }}>
          Что происходит в компании
        </p>
      </div>

      {/* Статистика */}
      <div className="animate-fade-in-up stagger-1 grid grid-cols-2 gap-4">
        <div
          className="rounded-xl p-4"
          style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--apex-success-bg)' }}
            >
              <Trophy size={18} style={{ color: 'var(--apex-primary)' }} />
            </div>
            <div>
              <div className="text-xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
                {awards.length}
              </div>
              <div className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
                Достижений за месяц
              </div>
            </div>
          </div>
        </div>
        <div
          className="rounded-xl p-4"
          style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--tag-purple-bg)' }}
            >
              <Heart size={18} style={{ color: 'var(--tag-purple-text)' }} />
            </div>
            <div>
              <div className="text-xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
                {gratitudes.length}
              </div>
              <div className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
                Благодарностей за 2 недели
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Секция достижений */}
      <div className="animate-fade-in-up stagger-2">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Trophy size={14} style={{ color: 'var(--orange-500)' }} />
            <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Достижения за {monthRange.label}
            </span>
          </div>
          <Link
            href="/activity/achievements"
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors hover:opacity-80"
            style={{ background: 'var(--surface)', color: 'var(--text-muted)' }}
          >
            Все достижения
            <ChevronRight size={12} />
          </Link>
        </div>

        {awards.length === 0 ? (
          <div
            className="rounded-2xl py-8 text-center"
            style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
          >
            <div className="text-3xl mb-3">🏆</div>
            <div className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>
              Пока никто не получил достижение
            </div>
            <div className="text-[12px] font-medium mt-1" style={{ color: 'var(--text-muted)' }}>
              Достижения появятся здесь, когда кто-то проведёт достаточно дней в топе
            </div>
          </div>
        ) : (
          <AwardsFilters awards={awards} hideMonthGroups />
        )}
      </div>

      {/* Секция благодарностей */}
      <div className="animate-fade-in-up stagger-3">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Heart size={14} style={{ color: 'var(--tag-purple-text)' }} />
            <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Благодарности за 2 недели
            </span>
          </div>
          <Link
            href="/activity/gratitudes"
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors hover:opacity-80"
            style={{ background: 'var(--surface)', color: 'var(--text-muted)' }}
          >
            Все благодарности
            <ChevronRight size={12} />
          </Link>
        </div>

        <CompanyGratitudeList items={gratitudes} pageSize={20} />
      </div>
    </div>
  )
}
