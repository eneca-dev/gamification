export interface TransactionSubItem {
  text: string
  url?: string
}

// Запуски Revit-плагинов внутри одной транзакции revit_using_plugins
export interface PluginUsage {
  plugin_name: string
  launch_count: number
}

// Отображаемые метаданные благодарности. В транзакциях встречаются только подарки:
// gift_source === 'quota' → квота, иначе (balance / gift_sent) → подарок.
export interface GratitudeMeta {
  isQuota: boolean
  categorySlug: string | null
}

const GRATITUDE_EVENT_TYPES = new Set(['gratitude_recipient_points', 'gratitude_gift_sent'])

export function getGratitudeMeta(
  eventType: string,
  details: Record<string, unknown> | null,
): GratitudeMeta | undefined {
  if (!GRATITUDE_EVENT_TYPES.has(eventType)) return undefined
  return {
    isQuota: (details?.gift_source as string | undefined) === 'quota',
    categorySlug: (details?.category as string | undefined) ?? null,
  }
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
  inlineLink?: TransactionSubItem
  productEmoji?: string
  productImageUrl?: string | null
  bonusTasks?: { id: string; name: string; url?: string; dateClosed?: string }[]
  taskClosedAt?: string
  plugins?: PluginUsage[]
  gratitude?: GratitudeMeta
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
  wrong_status_report: '⚠️',
  streak_reset_timetracking: '💔',
  streak_reset_dynamics: '💔',
  streak_reset_section: '💔',
  streak_reset_wrong_status: '💔',
  master_planner: '🏆',
  master_planner_reset: '💔',
  deadline_ok_l3: '⏳',
  deadline_revoked_l3: '↩️',
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

export interface TransactionFilters {
  sort?: 'date_desc' | 'date_asc'
  source?: string
  dateFrom?: string
  dateTo?: string
}

// Эти события хранятся с датой +1 (триггер БД), отображаем реальный день
const DATE_MINUS_ONE_TYPES = new Set(['red_day', 'wrong_status_report'])

export function getTransactionDisplayDate(
  eventType: string,
  eventDate: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = new Date(eventDate + 'T00:00:00')
  if (DATE_MINUS_ONE_TYPES.has(eventType)) {
    d.setDate(d.getDate() - 1)
  }
  return d.toLocaleDateString('ru-RU', options)
}
