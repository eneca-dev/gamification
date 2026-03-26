// Области достижений
export type AchievementArea = 'revit' | 'ws' | 'gratitude'

// Типы участников
export type AchievementEntityType = 'user' | 'team' | 'department'

// Прогресс по одной области
export interface AreaProgress {
  area: AchievementArea
  days_in_top: number
  threshold: number
  current_rank: number | null
  earned: boolean
  // Дополнительные поля для team/department
  team?: string
  department?: string
}

// Выданное достижение
export interface AchievementAward {
  entity_type: AchievementEntityType
  area: AchievementArea
  period_start: string
  days_in_top: number
  awarded_at: string
  score: number
}

// Полный ответ fn_ach_get_progress
export interface AchievementProgress {
  period_start: string
  period_end: string
  threshold: number
  team: string | null
  department: string | null
  personal: AreaProgress[]
  team_progress: AreaProgress[]
  department_progress: AreaProgress[]
  awards: AchievementAward[]
}

// Запись рейтинга (для отображения таблицы топа)
export interface RankingEntry {
  rank: number
  entity_id: string
  label: string        // ФИО / название команды / код отдела
  score: number
  extra?: string       // department_code для user, users_earning/total для team/dept
}

// Конфиг области для UI
export interface AchievementAreaConfig {
  area: AchievementArea
  label: string
  topSize: number
  icon: string
  color: string
  bg: string
}

export const ACHIEVEMENT_AREAS: AchievementAreaConfig[] = [
  {
    area: 'revit',
    label: 'Revit',
    topSize: 10,
    icon: 'Zap',
    color: 'var(--tag-orange-text)',
    bg: 'var(--tag-orange-bg)',
  },
  {
    area: 'ws',
    label: 'Worksection',
    topSize: 10,
    icon: 'CheckCircle',
    color: 'var(--apex-info-text)',
    bg: 'rgba(var(--apex-info-rgb), 0.08)',
  },
  {
    area: 'gratitude',
    label: 'Благодарности',
    topSize: 10,
    icon: 'Heart',
    color: 'var(--tag-purple-text)',
    bg: 'var(--tag-purple-bg)',
  },
]

// Бонусы за достижения (из gamification_event_types)
export const ACHIEVEMENT_BONUSES: Record<AchievementEntityType, number> = {
  user: 200,
  team: 150,
  department: 100,
}
