import { createSupabaseAdminClient } from '@/config/supabase'
import { cached, CACHE_1H } from '@/lib/server-cache'

import type { UserTransaction, TransactionSubItem } from './types'

const WS_BASE_URL = 'https://eneca.worksection.com/project'

function buildTaskUrl(projectId: string, taskId: string): string {
  return `${WS_BASE_URL}/${projectId}/${taskId}/`
}

async function _getUserTransactions(
  userEmail: string,
  limit = 10,
  offset = 0,
): Promise<UserTransaction[]> {
  const supabase = createSupabaseAdminClient()
  const normalizedEmail = userEmail.toLowerCase()

  const { data, error } = await supabase
    .from('view_user_transactions')
    .select('event_date, event_type, source, coins, description, details, created_at')
    .eq('user_email', normalizedEmail)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw new Error(error.message)

  const rows = data ?? []

  // Подтягиваем red_reasons для red_day событий
  const redDayDates = rows
    .filter((r) => r.event_type === 'red_day')
    .map((r) => r.event_date as string)

  let redReasonsMap = new Map<string, RedReason[]>()
  if (redDayDates.length > 0) {
    const { data: wsUser } = await supabase
      .from('ws_users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (wsUser) {
      const { data: statuses } = await supabase
        .from('ws_daily_statuses')
        .select('date, red_reasons')
        .eq('user_id', wsUser.id)
        .in('date', redDayDates)

      for (const s of statuses ?? []) {
        if (s.red_reasons) {
          redReasonsMap.set(s.date as string, s.red_reasons as RedReason[])
        }
      }
    }
  }

  // Подтягиваем emoji/image для покупок
  const purchaseProductIds = rows
    .filter((r) => r.event_type === 'shop_purchase' || r.event_type === 'shop_refund')
    .map((r) => (r.details as Record<string, unknown>)?.product_id as string)
    .filter(Boolean)

  let productMap = new Map<string, { name: string; emoji: string | null; image_url: string | null }>()
  if (purchaseProductIds.length > 0) {
    const { data: products } = await supabase
      .from('shop_products')
      .select('id, name, emoji, image_url')
      .in('id', [...new Set(purchaseProductIds)])

    for (const p of products ?? []) {
      productMap.set(p.id, { name: p.name, emoji: p.emoji, image_url: p.image_url })
    }
  }

  return rows.map((row, i) => {
    const eventType = row.event_type as string
    const details = row.details as Record<string, unknown> | null
    const redReasons = redReasonsMap.get(row.event_date as string)

    const productId = details?.product_id as string | undefined
    const product = productId ? productMap.get(productId) : undefined
    const enriched = enrichTransaction(eventType, row.description as string, details, redReasons, product?.name)

    return {
      id: `${row.created_at}-${i}`,
      event_type: eventType,
      source: row.source as string,
      event_date: row.event_date as string,
      coins: row.coins as number,
      description: enriched.description,
      details,
      created_at: row.created_at as string,
      subItems: enriched.subItems,
      productEmoji: product?.emoji ?? undefined,
      productImageUrl: product?.image_url ?? undefined,
    }
  })
}

export const getUserTransactions = (userEmail: string, limit = 10, offset = 0) =>
  cached(() => _getUserTransactions(userEmail, limit, offset),
    ['transactions', userEmail, String(limit), String(offset)],
    { tags: [`transactions:${userEmail}`], revalidate: CACHE_1H },
  )()

async function _getUserTransactionsCount(userEmail: string): Promise<number> {
  const supabase = createSupabaseAdminClient()
  const normalizedEmail = userEmail.toLowerCase()

  const { count, error } = await supabase
    .from('view_user_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('user_email', normalizedEmail)

  if (error) throw new Error(error.message)

  return count ?? 0
}

export const getUserTransactionsCount = (userEmail: string) =>
  cached(() => _getUserTransactionsCount(userEmail),
    ['transactions-count', userEmail],
    { tags: [`transactions:${userEmail}`], revalidate: CACHE_1H },
  )()

// ==================== Обогащение ====================

interface RedReason {
  type: string
  ws_task_id?: string
  ws_task_name?: string
  ws_project_id?: string
  ws_task_url?: string
  task_status?: string
}

const RED_REASON_LABELS: Record<string, string> = {
  red_day: 'Не внесены часы',
  task_dynamics_violation: 'Не сменена метка прогресса',
  section_red: 'Нарушение в секции',
  wrong_status_report: 'Время внесено не в статусе «В работе»',
}

interface EnrichedResult {
  description: string
  subItems?: TransactionSubItem[]
}

function enrichTransaction(
  eventType: string,
  defaultDesc: string,
  details: Record<string, unknown> | null,
  redReasons?: RedReason[],
  productName?: string,
): EnrichedResult {
  switch (eventType) {
    case 'shop_purchase': {
      const name = (details?.product_name as string | undefined) ?? productName
      return { description: name ? `Покупка: ${name}` : defaultDesc }
    }
    case 'shop_refund': {
      const name = (details?.product_name as string | undefined) ?? productName
      return { description: name ? `Возврат средств: ${name}` : 'Возврат средств за покупку' }
    }
    case 'red_day': {
      const subItems: TransactionSubItem[] = []
      if (redReasons && redReasons.length > 0) {
        const seen = new Set<string>()
        for (const r of redReasons) {
          const label = RED_REASON_LABELS[r.type] ?? r.type
          const text = r.ws_task_name ? `${label}: ${r.ws_task_name}` : label
          const key = `${r.type}-${r.ws_task_id ?? ''}`
          if (seen.has(key)) continue
          seen.add(key)

          const url = r.ws_task_url
            ?? (r.ws_project_id && r.ws_task_id ? buildTaskUrl(r.ws_project_id, r.ws_task_id) : undefined)

          subItems.push({ text, url })
        }
      }
      return { description: 'Красный день — сброс стрика', subItems: subItems.length > 0 ? subItems : undefined }
    }
    case 'streak_reset_timetracking':
      return { description: 'Сброс стрика: не внесены часы' }
    case 'streak_reset_dynamics': {
      const name = details?.ws_task_name as string | undefined
      return { description: name ? `Сброс стрика: не сменена метка (${name})` : 'Сброс стрика: не сменена метка' }
    }
    case 'streak_reset_section': {
      const name = details?.ws_task_name as string | undefined
      return { description: name ? `Сброс стрика: нарушение в секции (${name})` : 'Сброс стрика: нарушение в секции' }
    }
    case 'streak_reset_wrong_status':
      return { description: 'Сброс стрика: время в неверном статусе' }
    case 'wrong_status_report': {
      const name = details?.ws_task_name as string | undefined
      const status = details?.task_status as string | undefined
      const url = (details?.ws_task_url as string | undefined)
        ?? (details?.ws_project_id && details?.ws_task_id
          ? buildTaskUrl(details.ws_project_id as string, details.ws_task_id as string)
          : undefined)
      const statusLabel = status && status !== 'не установлен' ? `(${status})` : null
      const text = [name, statusLabel].filter(Boolean).join(' ')
      return {
        description: 'Время внесено не в статусе «В работе»',
        subItems: text ? [{ text, url }] : undefined,
      }
    }
    case 'task_dynamics_violation': {
      const name = details?.ws_task_name as string | undefined
      const url = details?.ws_project_id && details?.ws_task_id
        ? buildTaskUrl(details.ws_project_id as string, details.ws_task_id as string)
        : undefined
      return {
        description: 'Не сменена метка прогресса',
        subItems: name ? [{ text: name, url }] : undefined,
      }
    }
    case 'section_red': {
      const violations = details?.violations as Record<string, unknown>[] | undefined
      if (violations && violations.length > 0) {
        const subItems: TransactionSubItem[] = violations.map((v) => {
          const name = v.ws_task_name as string | undefined
          const url = v.ws_project_id && v.ws_task_id
            ? buildTaskUrl(v.ws_project_id as string, v.ws_task_id as string)
            : undefined
          const email = v.violator_email as string | undefined
          const text = [name, email].filter(Boolean).join(' — ')
          return { text: text || 'Нарушение динамики', url }
        })
        return { description: 'Нарушение динамики в секции', subItems }
      }
      // Fallback для старого формата
      const name = details?.ws_task_name as string | undefined
      const url = details?.ws_project_id && details?.ws_task_id
        ? buildTaskUrl(details.ws_project_id as string, details.ws_task_id as string)
        : undefined
      return {
        description: 'Нарушение динамики в секции',
        subItems: name ? [{ text: name, url }] : undefined,
      }
    }
    case 'budget_ok_l3':
    case 'budget_ok_l2': {
      const name = details?.ws_task_name as string | undefined
      return { description: name ? `Бюджет в норме: ${name}` : defaultDesc }
    }
    case 'budget_exceeded_l3':
    case 'budget_exceeded_l2': {
      const name = details?.ws_task_name as string | undefined
      return { description: name ? `Бюджет превышен: ${name}` : defaultDesc }
    }
    case 'budget_revoked_l3':
    case 'budget_revoked_l2':
    case 'budget_revoked_l3_lead': {
      const name = details?.ws_task_name as string | undefined
      return { description: name ? `Отзыв баллов: ${name}` : defaultDesc }
    }
    case 'revit_using_plugins': {
      const name = details?.plugin_name as string | undefined
      const count = details?.launch_count as number | undefined
      return { description: name ? `${name}: ${count ?? 1} запусков` : defaultDesc }
    }
    case 'gratitude_recipient_points': {
      const sender = details?.sender_name as string | undefined
      return { description: sender ? `Благодарность от ${sender}` : defaultDesc }
    }
    default:
      return { description: defaultDesc }
  }
}
