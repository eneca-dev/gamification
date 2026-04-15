import { Trophy, Users, Building2, Zap, CheckCircle, Heart } from 'lucide-react'

import type { CompanyAward, AchievementArea, AchievementEntityType } from '../types'

const AREA_UI: Record<AchievementArea, { label: string; icon: typeof Zap; color: string; bg: string }> = {
  revit: { label: 'Revit', icon: Zap, color: 'var(--tag-orange-text)', bg: 'var(--tag-orange-bg)' },
  ws: { label: 'Worksection', icon: CheckCircle, color: 'var(--apex-primary)', bg: 'var(--apex-success-bg)' },
  gratitude: { label: 'Благодарности', icon: Heart, color: 'var(--tag-purple-text)', bg: 'var(--tag-purple-bg)' },
}

const ENTITY_UI: Record<AchievementEntityType, { emoji: string; label: string }> = {
  user: { emoji: '🏆', label: 'Личное' },
  team: { emoji: '🛡️', label: 'Команда' },
  department: { emoji: '👑', label: 'Отдел' },
}

interface CompanyAwardCardProps {
  award: CompanyAward
}

export function CompanyAwardCard({ award }: CompanyAwardCardProps) {
  const area = AREA_UI[award.area] ?? AREA_UI.revit
  const entity = ENTITY_UI[award.entity_type] ?? ENTITY_UI.user
  const AreaIcon = area.icon

  return (
    <div
      className="rounded-xl p-3 flex items-center gap-2.5 transition-all card-hover"
      style={{
        background: 'var(--surface-elevated)',
        border: '1px solid var(--border)',
      }}
    >
      {/* Emoji */}
      <span className="text-xl shrink-0">{entity.emoji}</span>

      {/* Имя + метки */}
      <div className="min-w-0">
        <div className="text-[12px] font-bold truncate" style={{ color: 'var(--text-primary)' }}>
          {award.label}
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <div
            className="inline-flex items-center gap-0.5 px-1.5 py-px rounded-full"
            style={{ background: area.bg }}
          >
            <AreaIcon size={9} style={{ color: area.color }} />
            <span className="text-[9px] font-bold" style={{ color: area.color }}>
              {area.label}
            </span>
          </div>
          <span
            className="text-[9px] font-semibold px-1.5 py-px rounded-full"
            style={{ background: 'var(--surface)', color: 'var(--text-muted)' }}
          >
            {entity.label}
          </span>
        </div>
      </div>
    </div>
  )
}
