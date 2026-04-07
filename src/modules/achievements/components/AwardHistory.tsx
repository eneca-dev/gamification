'use client'

import { Trophy, Users, Building2 } from 'lucide-react'
import { CoinIcon } from '@/components/CoinIcon'

import type { AchievementAward } from '../types'
import { ACHIEVEMENT_BONUSES } from '../types'

const AREA_LABELS = {
  revit: 'Revit',
  ws: 'Worksection',
  gratitude: 'Благодарности',
} as const

const ENTITY_CONFIG = {
  user: { icon: Trophy, label: 'Личное' },
  team: { icon: Users, label: 'Команда' },
  department: { icon: Building2, label: 'Отдел' },
} as const

function formatPeriod(periodStart: string): string {
  const [year, month] = periodStart.split('-').map(Number)
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0) // последний день месяца
  const fmt = (d: Date) => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  return `${fmt(start)} - ${fmt(end)}`
}

interface AwardHistoryProps {
  awards: AchievementAward[]
}

export function AwardHistory({ awards }: AwardHistoryProps) {
  if (awards.length === 0) return null

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
    >
      <div className="text-[12px] font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
        История достижений
      </div>

      <div className="space-y-2">
        {awards.map((award) => {
          const entityCfg = ENTITY_CONFIG[award.entity_type]
          const Icon = entityCfg.icon
          const bonus = ACHIEVEMENT_BONUSES[award.entity_type]

          return (
            <div
              key={`${award.entity_type}-${award.area}-${award.period_start}`}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
              style={{ background: 'var(--apex-success-bg)', border: '1px solid var(--teal-100)' }}
            >
              <Icon size={16} style={{ color: 'var(--apex-success-text)' }} />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {AREA_LABELS[award.area]} — {entityCfg.label}
                </div>
                <div className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
                  {formatPeriod(award.period_start)} ({award.days_in_top} дней в топе)
                </div>
              </div>
              <span className="text-[13px] font-extrabold flex-shrink-0 inline-flex items-center gap-1" style={{ color: 'var(--apex-success-text)' }}>
                +{bonus} <CoinIcon size={13} />
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
