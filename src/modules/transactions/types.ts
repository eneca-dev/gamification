export interface TransactionSubItem {
  text: string
  url?: string
}

export interface UserTransaction {
  id: string
  event_type: string
  source: string
  event_date: string
  coins: number
  description: string
  details: Record<string, unknown> | null
  created_at: string
  subItems?: TransactionSubItem[]
  productEmoji?: string
  productImageUrl?: string | null
}

// Маппинг event_type → иконка
export const EVENT_ICONS: Record<string, string> = {
  green_day: '🟢',
  red_day: '🔴',
  revit_using_plugins: '⚡',
  revit_streak_7_bonus: '🔥',
  revit_streak_30_bonus: '🔥',
  ws_streak_7: '🔥',
  ws_streak_30: '🔥',
  ws_streak_90: '🔥',
  gratitude_recipient_points: '🤝',
  gratitude_gift_sent: '🎁',
  budget_ok_l3: '✅',
  budget_ok_l2: '✅',
  budget_ok_l3_lead_bonus: '✅',
  budget_exceeded_l3: '⚠️',
  budget_exceeded_l2: '⚠️',
  budget_revoked_l3: '↩️',
  budget_revoked_l2: '↩️',
  budget_revoked_l3_lead: '↩️',
  task_dynamics_violation: '⏰',
  section_red: '📋',
  streak_reset_timetracking: '💔',
  streak_reset_dynamics: '💔',
  streak_reset_section: '💔',
  master_planner: '🏆',
  master_planner_reset: '💔',
  shop_purchase: '🛒',
  shop_refund: '🛒',
  team_contest_top1_bonus: '🥇',
  ach_personal: '🏅',
  ach_team: '🏅',
  ach_department: '🏅',
  ach_gratitude_help: '🏅',
  ach_gratitude_mentoring: '🏅',
  ach_gratitude_quality: '🏅',
}

export function getEventIcon(eventType: string): string {
  return EVENT_ICONS[eventType] ?? '💰'
}
