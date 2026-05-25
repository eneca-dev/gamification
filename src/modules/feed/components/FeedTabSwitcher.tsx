'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Building2, Users, User } from 'lucide-react'

type FeedTab = 'company' | 'dept' | 'team'

interface FeedTabSwitcherProps {
  hasDepartment: boolean
  hasTeam: boolean
}

const TABS: { id: FeedTab; label: string; Icon: typeof Building2 }[] = [
  { id: 'company', label: 'Компания', Icon: Building2 },
  { id: 'dept', label: 'Отдел', Icon: Users },
  { id: 'team', label: 'Команда', Icon: User },
]

export function FeedTabSwitcher({ hasDepartment, hasTeam }: FeedTabSwitcherProps) {
  const searchParams = useSearchParams()
  const current = (searchParams.get('feed') ?? 'company') as FeedTab

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {TABS.map(({ id, label, Icon }) => {
        const disabled = (id === 'dept' && !hasDepartment) || (id === 'team' && !hasTeam)
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
          </Link>
        )
      })}
    </div>
  )
}
