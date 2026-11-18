'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Building2, PawPrint, Users, User } from 'lucide-react'

type FeedTab = 'company' | 'dept' | 'team' | 'bimo'

interface FeedTabSwitcherProps {
  hasDepartment: boolean
  hasTeam: boolean
  /** Галерея Бимо доступна только при включённой коллекции и известном сотруднике. */
  hasBimo?: boolean
  /** Остаток лайков месяца: напоминание о голосовании на любой вкладке. */
  bimoLikesLeft?: number | null
}

const TABS: { id: FeedTab; label: string; Icon: typeof Building2 }[] = [
  { id: 'company', label: 'Компания', Icon: Building2 },
  { id: 'dept', label: 'Отдел', Icon: Users },
  { id: 'team', label: 'Команда', Icon: User },
  { id: 'bimo', label: 'Бимо', Icon: PawPrint },
]

export function FeedTabSwitcher({ hasDepartment, hasTeam, hasBimo = false, bimoLikesLeft = null }: FeedTabSwitcherProps) {
  const searchParams = useSearchParams()
  const current = (searchParams.get('feed') ?? 'company') as FeedTab

  return (
    <div className="flex items-center gap-1.5 flex-wrap" data-onboarding="feed-tabs">
      {TABS.map(({ id, label, Icon }) => {
        const disabled = (id === 'dept' && !hasDepartment) || (id === 'team' && !hasTeam) || (id === 'bimo' && !hasBimo)
        const isActive = current === id

        if (disabled) return null

        const href = id === 'company' ? '/activity' : `/activity?feed=${id}`

        return (
          <Link
            key={id}
            href={href}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold transition-all duration-150"
            style={
              isActive
                ? {
                    background: 'var(--apex-primary)',
                    color: 'var(--apex-surface)',
                    pointerEvents: 'none',
                  }
                : {
                    background: 'var(--surface-elevated)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border)',
                  }
            }
          >
            <Icon size={12} />
            {label}
            {/* Непотраченные лайки видно с любой вкладки — иначе про голосование забывают. */}
            {id === 'bimo' && bimoLikesLeft !== null && bimoLikesLeft > 0 && (
              <span
                className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold"
                style={isActive
                  ? { background: 'var(--apex-surface)', color: 'var(--apex-primary)' }
                  : { background: 'var(--apex-error-bg)', color: 'var(--apex-danger)' }}
                title={`Непотраченных лайков: ${bimoLikesLeft}`}
              >
                {bimoLikesLeft}
              </span>
            )}
          </Link>
        )
      })}
    </div>
  )
}
