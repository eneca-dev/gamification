import { createSupabaseAdminClient } from '@/config/supabase'
import { cached, CACHE_5M } from '@/lib/server-cache'

import type { UserTransaction, TransactionSubItem, TransactionFilters } from './types'

const WS_BASE_URL = 'https://eneca.worksection.com/project'

function buildTaskUrl(projectId: string, taskId: string): string {
  return `${WS_BASE_URL}/${projectId}/${taskId}/`
}

const BUDGET_L3_TYPES = new Set([
  'budget_ok_l3',
  'budget_ok_l3_lead_bonus',
  'budget_exceeded_l3',
  'budget_revoked_l3',
  'budget_revoked_l3_lead',
])

const BUDGET_L2_TYPES = new Set([
  'budget_ok_l2',
  'budget_exceeded_l2',
  'budget_revoked_l2',
])

// Для revoked-событий ws_task_id хранится внутри original_details
function getBudgetTaskId(eventType: string, details: Record<string, unknown> | null): string | undefined {
  if (!details) return undefined
  const source = eventType.startsWith('budget_revoked_')
    ? (details.original_details as Record<string, unknown> | undefined)
    : details
  return source?.ws_task_id as string | undefined
}

interface BudgetTaskInfo {
  name: string
  url?: string
  dateClosed?: string
}

const MASTER_PLANNER_L3_TYPES = new Set(['master_planner', 'master_planner_revoked'])
const MASTER_PLANNER_L2_TYPES = new Set(['master_planner_l2', 'master_planner_l2_revoked'])

interface BonusTask {
  id: string
  name: string
  url?: string
  dateClosed?: string
}

interface BonusTaskInfo {
  url?: string
  dateClosed?: string
}

// Для бонусов: details.tasks (10 задач серии).
// Для revoked: только details.revoked_tasks — задачи, реально сорвавшие серию (обычно 1).
// Для bulk-amnesty (нет revoked_tasks) возвращаем null — у амнистии нет «одного виновника»,
// раскрытие не показывается, чтобы не вводить в заблуждение.
function getMasterPlannerTasks(
  eventType: string,
  details: Record<string, unknown> | null,
): { id: string; name: string }[] | null {
  if (!details) return null
  if (eventType.endsWith('_revoked')) {
    const revoked = details.revoked_tasks as { id: string; name: string }[] | undefined
    return revoked && revoked.length > 0 ? revoked : null
  }
  const tasks = details.tasks as { id: string; name: string }[] | undefined
  return tasks && tasks.length > 0 ? tasks : null
}

async function _getUserTransactions(
  userEmail: string,
  limit = 10,
  offset = 0,
  filters: TransactionFilters = {},
): Promise<UserTransaction[]> {
  const supabase = createSupabaseAdminClient()
  const normalizedEmail = userEmail.toLowerCase()
  const { sort = 'date_desc', source, dateFrom, dateTo } = filters

  let query = supabase
    .from('view_user_transactions')
    .select('transaction_id, event_date, event_type, source, coins, description, details, created_at')
    .eq('user_email', normalizedEmail)

  if (source && source !== 'all') {
    if (source === 'achievements') {
      query = query.in('source', ['achievements', 'contest'])
    } else {
      query = query.eq('source', source)
    }
  }
  if (dateFrom) query = query.gte('event_date', dateFrom)
  if (dateTo) query = query.lte('event_date', dateTo)

  const { data, error } = await query
    .order('event_date', { ascending: sort === 'date_asc' })
    .order('created_at', { ascending: sort === 'date_asc' })
    .range(offset, offset + limit - 1)

  if (error) throw new Error(error.message)

  const rows = data ?? []

  // Подтягиваем red_reasons для red_day событий.
  // Триггер trg_fix_ws_event_date добавляет +1 день ко всем WS event_date,
  // поэтому ищем в ws_daily_statuses по event_date - 1 (реальный рабочий день).
  const redDayRows = rows.filter((r) => r.event_type === 'red_day')
  const redDayDateMap = new Map<string, string>() // event_date → actual_date (event_date - 1)
  for (const r of redDayRows) {
    const eventDate = r.event_date as string
    const d = new Date(eventDate + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() - 1)
    redDayDateMap.set(eventDate, d.toISOString().slice(0, 10))
  }

  let redReasonsMap = new Map<string, RedReason[]>()
  if (redDayDateMap.size > 0) {
    const { data: wsUser } = await supabase
      .from('ws_users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (wsUser) {
      const actualDates = [...redDayDateMap.values()]
      const { data: statuses } = await supabase
        .from('ws_daily_statuses')
        .select('date, red_reasons')
        .eq('user_id', wsUser.id)
        .in('date', actualDates)

      // Строим Map по event_date (не по actual_date), чтобы матчить с rows
      const actualToReasons = new Map((statuses ?? [])
        .filter((s) => s.red_reasons)
        .map((s) => [s.date as string, s.red_reasons as RedReason[]]))

      for (const [eventDate, actualDate] of redDayDateMap) {
        const reasons = actualToReasons.get(actualDate)
        if (reasons) redReasonsMap.set(eventDate, reasons)
      }
    }
  }

  // Подтягиваем родительские ID для deadline событий (для построения полного URL)
  const deadlineTaskIds = rows
    .filter((r) => r.event_type === 'deadline_ok_l3' || r.event_type === 'deadline_revoked_l3')
    .map((r) => (r.details as Record<string, unknown>)?.ws_task_id as string)
    .filter(Boolean)

  let deadlineUrlMap = new Map<string, string>()
  if (deadlineTaskIds.length > 0) {
    const { data: l3Rows } = await supabase
      .from('ws_tasks_l3')
      .select('ws_task_id, ws_project_id, parent_l2_id')
      .in('ws_task_id', [...new Set(deadlineTaskIds)])

    const l2Ids = [...new Set((l3Rows ?? []).map((r) => r.parent_l2_id).filter(Boolean))]
    if (l2Ids.length > 0) {
      const { data: l2Rows } = await supabase
        .from('ws_tasks_l2')
        .select('ws_task_id, parent_l1_id')
        .in('ws_task_id', l2Ids)

      const l2Map = new Map((l2Rows ?? []).map((r) => [r.ws_task_id, r.parent_l1_id]))
      for (const l3 of l3Rows ?? []) {
        const l1Id = l2Map.get(l3.parent_l2_id)
        if (l3.ws_project_id && l1Id) {
          deadlineUrlMap.set(
            l3.ws_task_id,
            `https://eneca.worksection.com/project/${l3.ws_project_id}/${l1Id}/${l3.ws_task_id}/`,
          )
        }
      }
    }
  }

  // Подтягиваем имя и URL задачи для budget-событий (детали в БД, не в payload)
  const budgetL3TaskIds = rows
    .filter((r) => BUDGET_L3_TYPES.has(r.event_type as string))
    .map((r) => getBudgetTaskId(r.event_type as string, r.details as Record<string, unknown> | null))
    .filter((v): v is string => Boolean(v))

  const budgetL2TaskIds = rows
    .filter((r) => BUDGET_L2_TYPES.has(r.event_type as string))
    .map((r) => getBudgetTaskId(r.event_type as string, r.details as Record<string, unknown> | null))
    .filter((v): v is string => Boolean(v))

  const budgetTaskInfoMap = new Map<string, BudgetTaskInfo>()

  if (budgetL3TaskIds.length > 0) {
    const { data: l3Rows } = await supabase
      .from('ws_tasks_l3')
      .select('ws_task_id, ws_project_id, parent_l2_id, name, date_closed')
      .in('ws_task_id', [...new Set(budgetL3TaskIds)])

    const parentL2Ids = [...new Set((l3Rows ?? []).map((r) => r.parent_l2_id).filter(Boolean) as string[])]
    let l2ToL1 = new Map<string, string>()
    if (parentL2Ids.length > 0) {
      const { data: l2Parents } = await supabase
        .from('ws_tasks_l2')
        .select('ws_task_id, parent_l1_id')
        .in('ws_task_id', parentL2Ids)
      l2ToL1 = new Map(
        (l2Parents ?? []).map((r) => [r.ws_task_id as string, r.parent_l1_id as string]),
      )
    }

    for (const l3 of l3Rows ?? []) {
      if (!l3.name) continue
      const l1Id = l2ToL1.get(l3.parent_l2_id as string)
      const url = l3.ws_project_id && l1Id
        ? `${WS_BASE_URL}/${l3.ws_project_id}/${l1Id}/${l3.ws_task_id}/`
        : undefined
      budgetTaskInfoMap.set(`l3:${l3.ws_task_id}`, {
        name: l3.name as string,
        url,
        dateClosed: (l3.date_closed as string | null) ?? undefined,
      })
    }
  }

  if (budgetL2TaskIds.length > 0) {
    const { data: l2Rows } = await supabase
      .from('ws_tasks_l2')
      .select('ws_task_id, ws_project_id, parent_l1_id, name, date_closed')
      .in('ws_task_id', [...new Set(budgetL2TaskIds)])

    for (const l2 of l2Rows ?? []) {
      if (!l2.name) continue
      const url = l2.ws_project_id && l2.parent_l1_id
        ? `${WS_BASE_URL}/${l2.ws_project_id}/${l2.parent_l1_id}/${l2.ws_task_id}/`
        : undefined
      budgetTaskInfoMap.set(`l2:${l2.ws_task_id}`, {
        name: l2.name as string,
        url,
        dateClosed: (l2.date_closed as string | null) ?? undefined,
      })
    }
  }

  // Подтягиваем имя/URL для master_planner-бонусов (списки в details.tasks / original_details.tasks)
  const bonusL3Ids = new Set<string>()
  const bonusL2Ids = new Set<string>()

  for (const r of rows) {
    const tasks = getMasterPlannerTasks(r.event_type as string, r.details as Record<string, unknown> | null)
    if (!tasks) continue
    const target = MASTER_PLANNER_L2_TYPES.has(r.event_type as string) ? bonusL2Ids : bonusL3Ids
    for (const t of tasks) target.add(t.id)
  }

  const bonusInfoMap = new Map<string, BonusTaskInfo>() // key: `${level}:${id}` → { url, dateClosed }

  if (bonusL3Ids.size > 0) {
    const { data: l3Rows } = await supabase
      .from('ws_tasks_l3')
      .select('ws_task_id, ws_project_id, parent_l2_id, date_closed')
      .in('ws_task_id', [...bonusL3Ids])

    const parentL2Ids = [...new Set((l3Rows ?? []).map((r) => r.parent_l2_id).filter(Boolean) as string[])]
    let l2ToL1 = new Map<string, string>()
    if (parentL2Ids.length > 0) {
      const { data: l2Parents } = await supabase
        .from('ws_tasks_l2')
        .select('ws_task_id, parent_l1_id')
        .in('ws_task_id', parentL2Ids)
      l2ToL1 = new Map(
        (l2Parents ?? []).map((r) => [r.ws_task_id as string, r.parent_l1_id as string]),
      )
    }

    for (const l3 of l3Rows ?? []) {
      const l1Id = l2ToL1.get(l3.parent_l2_id as string)
      const url = l3.ws_project_id && l1Id
        ? `${WS_BASE_URL}/${l3.ws_project_id}/${l1Id}/${l3.ws_task_id}/`
        : undefined
      bonusInfoMap.set(`l3:${l3.ws_task_id}`, {
        url,
        dateClosed: (l3.date_closed as string | null) ?? undefined,
      })
    }
  }

  if (bonusL2Ids.size > 0) {
    const { data: l2Rows } = await supabase
      .from('ws_tasks_l2')
      .select('ws_task_id, ws_project_id, parent_l1_id, date_closed')
      .in('ws_task_id', [...bonusL2Ids])

    for (const l2 of l2Rows ?? []) {
      const url = l2.ws_project_id && l2.parent_l1_id
        ? `${WS_BASE_URL}/${l2.ws_project_id}/${l2.parent_l1_id}/${l2.ws_task_id}/`
        : undefined
      bonusInfoMap.set(`l2:${l2.ws_task_id}`, {
        url,
        dateClosed: (l2.date_closed as string | null) ?? undefined,
      })
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

  // Подтягиваем имя отправителя для благодарностей (получатель видит от кого)
  const gratitudeSenderEmails = rows
    .filter((r) => r.event_type === 'gratitude_recipient_points')
    .map((r) => (r.details as Record<string, unknown>)?.sender_email as string)
    .filter(Boolean)

  const senderNameMap = new Map<string, string>()
  if (gratitudeSenderEmails.length > 0) {
    const { data: senders } = await supabase
      .from('ws_users')
      .select('email, first_name, last_name')
      .in('email', [...new Set(gratitudeSenderEmails)])

    for (const s of senders ?? []) {
      senderNameMap.set(s.email, `${s.first_name} ${s.last_name}`.trim())
    }
  }

  // Подтягиваем имя получателя для отправленных благодарностей (отправитель видит кому)
  const giftSentRecipientEmails = rows
    .filter((r) => r.event_type === 'gratitude_gift_sent')
    .map((r) => (r.details as Record<string, unknown>)?.recipient_email as string)
    .filter(Boolean)

  const recipientNameByEmail = new Map<string, string>()
  if (giftSentRecipientEmails.length > 0) {
    const { data: recipients } = await supabase
      .from('ws_users')
      .select('email, first_name, last_name')
      .in('email', [...new Set(giftSentRecipientEmails)])

    for (const r of recipients ?? []) {
      recipientNameByEmail.set(r.email, `${r.first_name} ${r.last_name}`.trim())
    }
  }

  return rows.map((row, i) => {
    const eventType = row.event_type as string
    const details = row.details as Record<string, unknown> | null
    const redReasons = redReasonsMap.get(row.event_date as string)

    const productId = details?.product_id as string | undefined
    const product = productId ? productMap.get(productId) : undefined
    const deadlineTaskId = details?.ws_task_id as string | undefined
    const taskUrl = deadlineTaskId ? deadlineUrlMap.get(deadlineTaskId) : undefined

    let budgetTaskInfo: BudgetTaskInfo | undefined
    if (BUDGET_L3_TYPES.has(eventType)) {
      const id = getBudgetTaskId(eventType, details)
      if (id) budgetTaskInfo = budgetTaskInfoMap.get(`l3:${id}`)
    } else if (BUDGET_L2_TYPES.has(eventType)) {
      const id = getBudgetTaskId(eventType, details)
      if (id) budgetTaskInfo = budgetTaskInfoMap.get(`l2:${id}`)
    }

    let bonusTasks: BonusTask[] | undefined
    if (MASTER_PLANNER_L3_TYPES.has(eventType) || MASTER_PLANNER_L2_TYPES.has(eventType)) {
      const tasks = getMasterPlannerTasks(eventType, details)
      if (tasks) {
        const level: 'l3' | 'l2' = MASTER_PLANNER_L2_TYPES.has(eventType) ? 'l2' : 'l3'
        bonusTasks = tasks.map((t) => {
          const info = bonusInfoMap.get(`${level}:${t.id}`)
          return {
            id: t.id,
            name: t.name,
            url: info?.url,
            dateClosed: info?.dateClosed,
          }
        })
      }
    }

    // Дата закрытия задачи: budget_* — из ws_tasks_*; deadline_ok_l3 — из details;
    // deadline_revoked_l3 — из original_details.
    let taskClosedAt: string | undefined
    if (budgetTaskInfo?.dateClosed) {
      taskClosedAt = budgetTaskInfo.dateClosed
    } else if (eventType === 'deadline_ok_l3') {
      taskClosedAt = (details?.date_closed as string | undefined) ?? undefined
    } else if (eventType === 'deadline_revoked_l3') {
      const original = details?.original_details as Record<string, unknown> | undefined
      taskClosedAt = (original?.date_closed as string | undefined) ?? undefined
    }

    const senderEmail = details?.sender_email as string | undefined
    const senderName = senderEmail ? senderNameMap.get(senderEmail) : undefined

    const recipientEmailFromDetails = details?.recipient_email as string | undefined
    const recipientName = recipientEmailFromDetails ? recipientNameByEmail.get(recipientEmailFromDetails) : undefined

    const enriched = enrichTransaction(eventType, row.description as string, details, redReasons, product?.name, taskUrl, budgetTaskInfo, senderName, recipientName)

    return {
      id: row.transaction_id as string,
      event_type: eventType,
      source: row.source as string,
      event_date: row.event_date as string,
      coins: row.coins as number,
      description: enriched.description,
      details,
      created_at: row.created_at as string,
      subItems: enriched.subItems,
      inlineLink: enriched.inlineLink,
      productEmoji: product?.emoji ?? undefined,
      productImageUrl: product?.image_url ?? undefined,
      taskClosedAt,
      bonusTasks,
    }
  })
}

export const getUserTransactions = (userEmail: string, limit = 10, offset = 0, filters: TransactionFilters = {}) =>
  cached(
    () => _getUserTransactions(userEmail, limit, offset, filters),
    ['transactions', userEmail, String(limit), String(offset), filters.sort ?? 'date_desc', filters.source ?? 'all', filters.dateFrom ?? '', filters.dateTo ?? ''],
    { tags: [`transactions:${userEmail}`], revalidate: CACHE_5M },
  )()

async function _getUserTransactionsCount(userEmail: string, filters: TransactionFilters = {}): Promise<number> {
  const supabase = createSupabaseAdminClient()
  const normalizedEmail = userEmail.toLowerCase()
  const { source, dateFrom, dateTo } = filters

  let query = supabase
    .from('view_user_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('user_email', normalizedEmail)

  if (source && source !== 'all') {
    if (source === 'achievements') {
      query = query.in('source', ['achievements', 'contest'])
    } else {
      query = query.eq('source', source)
    }
  }
  if (dateFrom) query = query.gte('event_date', dateFrom)
  if (dateTo) query = query.lte('event_date', dateTo)

  const { count, error } = await query

  if (error) throw new Error(error.message)

  return count ?? 0
}

export const getUserTransactionsCount = (userEmail: string, filters: TransactionFilters = {}) =>
  cached(
    () => _getUserTransactionsCount(userEmail, filters),
    ['transactions-count', userEmail, filters.source ?? 'all', filters.dateFrom ?? '', filters.dateTo ?? ''],
    { tags: [`transactions:${userEmail}`], revalidate: CACHE_5M },
  )()

async function _getUserTransactionsSum(userEmail: string, filters: TransactionFilters = {}): Promise<number> {
  const supabase = createSupabaseAdminClient()
  const normalizedEmail = userEmail.toLowerCase()
  const { source, dateFrom, dateTo } = filters

  let query = supabase
    .from('view_user_transactions')
    .select('coins')
    .eq('user_email', normalizedEmail)

  if (source && source !== 'all') {
    if (source === 'achievements') {
      query = query.in('source', ['achievements', 'contest'])
    } else {
      query = query.eq('source', source)
    }
  }
  if (dateFrom) query = query.gte('event_date', dateFrom)
  if (dateTo) query = query.lte('event_date', dateTo)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return (data ?? []).reduce((sum, row) => sum + (row.coins as number), 0)
}

export const getUserTransactionsSum = (userEmail: string, filters: TransactionFilters = {}) =>
  cached(
    () => _getUserTransactionsSum(userEmail, filters),
    ['transactions-sum', userEmail, filters.source ?? 'all', filters.dateFrom ?? '', filters.dateTo ?? ''],
    { tags: [`transactions:${userEmail}`], revalidate: CACHE_5M },
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

const GRATITUDE_CATEGORY_LABELS: Record<string, string> = {
  help: 'Помощь и поддержка',
  quality: 'Профессионализм',
  mentoring: 'Наставничество',
  teamwork: 'Командная работа',
  atmosphere: 'Позитив и атмосфера',
  other: 'Другое',
}

const RED_REASON_LABELS: Record<string, string> = {
  red_day: 'Не внесены часы',
  task_dynamics_violation: 'Не сменена метка прогресса',
  section_red: 'Не обновлена метка прогресса в задаче L3 раздела',
  wrong_status_report: 'Время внесено не в статусе «В работе»',
}

interface EnrichedResult {
  description: string
  subItems?: TransactionSubItem[]
  inlineLink?: TransactionSubItem
}

function enrichTransaction(
  eventType: string,
  defaultDesc: string,
  details: Record<string, unknown> | null,
  redReasons?: RedReason[],
  productName?: string,
  taskUrl?: string,
  budgetTaskInfo?: BudgetTaskInfo,
  senderName?: string,
  recipientName?: string,
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
      if (!redReasons || redReasons.length === 0) {
        return { description: 'Красный день' }
      }

      const seen = new Set<string>()
      const unique: Array<{ label: string; taskName?: string; url?: string }> = []
      for (const r of redReasons) {
        const key = `${r.type}-${r.ws_task_id ?? ''}`
        if (seen.has(key)) continue
        seen.add(key)
        const label = RED_REASON_LABELS[r.type] ?? r.type
        const url = r.ws_task_url
          ?? (r.ws_project_id && r.ws_task_id ? buildTaskUrl(r.ws_project_id, r.ws_task_id) : undefined)
        unique.push({ label, taskName: r.ws_task_name, url })
      }

      if (unique.length === 1) {
        const { label, taskName, url } = unique[0]
        if (taskName) {
          return {
            description: `Красный день: ${label}:`,
            inlineLink: { text: taskName, url },
          }
        }
        return { description: `Красный день: ${label}` }
      }

      const subItems: TransactionSubItem[] = unique.map(({ label, taskName, url }) => ({
        text: taskName ? `${label}: ${taskName}` : label,
        url,
      }))
      return { description: 'Красный день:', subItems }
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
        description: 'Время внесено не в статусе «В работе»:',
        inlineLink: text ? { text, url } : undefined,
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
    case 'budget_ok_l2':
    case 'budget_ok_l3_lead_bonus': {
      if (!budgetTaskInfo) return { description: defaultDesc }
      return {
        description: 'Бюджет в норме:',
        inlineLink: { text: budgetTaskInfo.name, url: budgetTaskInfo.url },
      }
    }
    case 'budget_exceeded_l3':
    case 'budget_exceeded_l2': {
      if (!budgetTaskInfo) return { description: defaultDesc }
      return {
        description: 'Бюджет превышен:',
        inlineLink: { text: budgetTaskInfo.name, url: budgetTaskInfo.url },
      }
    }
    case 'budget_revoked_l3': {
      if (!budgetTaskInfo) return { description: defaultDesc }
      return {
        description: 'Превышен бюджет задачи — баллы отозваны (ранее начисленные 💎 аннулированы):',
        inlineLink: { text: budgetTaskInfo.name, url: budgetTaskInfo.url },
      }
    }
    case 'budget_revoked_l2': {
      if (!budgetTaskInfo) return { description: defaultDesc }
      return {
        description: 'Превышен бюджет раздела — баллы отозваны (ранее начисленные 💎 аннулированы):',
        inlineLink: { text: budgetTaskInfo.name, url: budgetTaskInfo.url },
      }
    }
    case 'budget_revoked_l3_lead': {
      if (!budgetTaskInfo) return { description: defaultDesc }
      return {
        description: 'Бюджет задачи превышен — бонус тимлида отозван (ранее начисленные 💎 аннулированы):',
        inlineLink: { text: budgetTaskInfo.name, url: budgetTaskInfo.url },
      }
    }
    case 'revit_using_plugins': {
      const plugins = details?.plugins as Array<{ plugin_name: string; launch_count: number }> | undefined
      if (plugins && plugins.length > 1) {
        const total = plugins.reduce((sum, p) => sum + p.launch_count, 0)
        return { description: `Revit-плагины: ${total} запусков` }
      }
      const name = details?.plugin_name as string | undefined
      const count = details?.launch_count as number | undefined
      return { description: name ? `${name}: ${count ?? 1} запусков` : defaultDesc }
    }
    case 'gratitude_recipient_points': {
      return { description: senderName ? `Благодарность от ${senderName}` : defaultDesc }
    }
    case 'gratitude_gift_sent': {
      return { description: recipientName ? `Благодарность для ${recipientName}` : defaultDesc }
    }
    case 'deadline_ok_l3': {
      const name = details?.ws_task_name as string | undefined
      return {
        description: 'Закрыта до плановой даты:',
        inlineLink: name ? { text: name, url: taskUrl } : undefined,
      }
    }
    case 'deadline_revoked_l3': {
      const name = details?.ws_task_name as string | undefined
      return {
        description: 'Задача переоткрыта — бонус за срок отозван (ранее начисленные 💎 аннулированы):',
        inlineLink: name ? { text: name, url: taskUrl } : undefined,
      }
    }
    case 'ach_personal': {
      const areaLabels: Record<string, string> = { revit: 'Revit', ws: 'Worksection' }
      const area = details?.area as string | undefined
      const areaLabel = area ? (areaLabels[area] ?? area) : null
      return {
        description: areaLabel ? `Личное достижение: топ-10 в рейтинге ${areaLabel}` : defaultDesc,
      }
    }
    case 'ach_department': {
      const areaLabels: Record<string, string> = { revit: 'Revit', ws: 'Worksection' }
      const area = details?.area as string | undefined
      const department = details?.department as string | undefined
      const areaLabel = area ? (areaLabels[area] ?? area) : null
      const deptLabel = department ? ` (отдел ${department})` : ''
      return {
        description: areaLabel ? `Достижение отдела: топ-5 в рейтинге ${areaLabel}${deptLabel}` : defaultDesc,
      }
    }
    default: {
      if (eventType.startsWith('ach_gratitude_')) {
        const slug = eventType.slice('ach_gratitude_'.length)
        const label = GRATITUDE_CATEGORY_LABELS[slug] ?? slug
        const threshold = details?.threshold as number | undefined
        return {
          description: threshold
            ? `Получено ${threshold} подарка в категории «${label}» за месяц`
            : `Достижение по благодарностям: «${label}»`,
        }
      }
      return { description: defaultDesc }
    }
  }
}
