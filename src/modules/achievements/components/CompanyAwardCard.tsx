import { Trophy, Users, Building2, Zap, CheckCircle, Heart } from 'lucide-react'

import type { CompanyAward, AchievementArea, AchievementEntityType } from '../types'
import { ACHIEVEMENT_BONUSES } from '../types'

const AREA_UI: Record<AchievementArea, { label: string; icon: typeof Zap; color: string; bg: string }> = {
  revit: { label: 'Revit', icon: Zap, color: 'var(--tag-orange-text)', bg: 'var(--tag-orange-bg)' },
  ws: { label: 'Worksection', icon: CheckCircle, color: 'var(--apex-primary)', bg: 'var(--apex-success-bg)' },
  gratitude: { label: 'Благодарности', icon: Heart, color: 'var(--tag-purple-text)', bg: 'var(--tag-purple-bg)' },
}

const ENTITY_UI: Record<AchievementEntityType, { emoji: string; label: string; icon: typeof Trophy }> = {
  user: { emoji: '🏆', label: 'Личное', icon: Trophy },
  team: { emoji: '🛡️', label: 'Команда', icon: Users },
  department: { emoji: '👑', label: 'Отдел', icon: Building2 },
}

interface CompanyAwardCardProps {
  award: CompanyAward
}

export function CompanyAwardCard({ award }: CompanyAwardCardProps) {
  const area = AREA_UI[award.area] ?? AREA_UI.revit
  const entity = ENTITY_UI[award.entity_type] ?? ENTITY_UI.user
  const bonus = ACHIEVEMENT_BONUSES[award.entity_type]
  const AreaIcon = area.icon

  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3 transition-all card-hover"
      style={{
        background: 'var(--surface-elevated)',
        border: `1px solid ${area.color}22`,
      }}
    >
      {/* Верхняя часть: emoji + область */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{entity.emoji}</span>
          <div
            className="flex items-center gap-1 px-2 py-0.5 rounded-full"
            style={{ background: area.bg }}
          >
            <AreaIcon size={11} style={{ color: area.color }} />
            <span className="text-[10px] font-bold" style={{ color: area.color }}>
              {area.label}
            </span>
          </div>
        </div>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: 'var(--surface)', color: 'var(--text-muted)' }}
        >
          {entity.label}
        </span>
      </div>

      {/* Имя */}
      <div className="text-[14px] font-bold truncate" style={{ color: 'var(--text-primary)' }}>
        {award.label}
      </div>

      {/* Статистика */}
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
          {award.days_in_top} дн. в топе
        </span>
        <span
          className="text-[11px] font-bold px-2 py-0.5 rounded-md"
          style={{ background: area.bg, color: area.color }}
        >
          +{bonus} ПК
        </span>
      </div>
    </div>
  )
}
