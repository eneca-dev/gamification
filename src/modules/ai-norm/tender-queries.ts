import { createSupabaseAdminClient } from '@/config/supabase'

export type TenderProject = 'advisor' | 'digest'

const PAGE_SIZE = 1000

interface UsageRow {
  work_date: string
  alias_key: string
  action: string
  event_count: number
  synced_at: string
  alias_name: string | null
  ws_user_id: string | null
  user_email: string | null
  user_name: string | null
}

function nextMonth(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10)
}

async function loadUsageRows(project: TenderProject, month: string, wsUserId?: string): Promise<UsageRow[]> {
  const supabase = createSupabaseAdminClient()
  const rows: UsageRow[] = []
  for (let start = 0; ; start += PAGE_SIZE) {
    let query = supabase.from('ai_tender_usage_resolved')
      .select('work_date, alias_key, action, event_count, synced_at, alias_name, ws_user_id, user_email, user_name')
      .eq('project', project)
      .gte('work_date', `${month}-01`)
      .lt('work_date', nextMonth(month))
    if (wsUserId) query = query.eq('ws_user_id', wsUserId)
    const { data, error } = await query
      .order('work_date').order('alias_key').order('action')
      .range(start, start + PAGE_SIZE - 1)
    if (error) throw new Error(`Unable to load Tender ${project} usage: ${error.message}`)
    rows.push(...(data ?? []))
    if ((data?.length ?? 0) < PAGE_SIZE) break
  }
  return rows
}

export interface TenderPersonalActivity {
  events: number
  dates: string[]
  actions: Record<string, number>
}

async function getPersonalActivity(
  project: TenderProject,
  wsUserId: string | null,
  month: string,
): Promise<TenderPersonalActivity> {
  if (!wsUserId) return { events: 0, dates: [], actions: {} }
  const dates = new Set<string>()
  const actions: Record<string, number> = {}
  let events = 0
  for (const row of await loadUsageRows(project, month, wsUserId)) {
    dates.add(row.work_date)
    actions[row.action] = (actions[row.action] ?? 0) + row.event_count
    events += row.event_count
  }
  return { events, dates: [...dates].sort((a, b) => b.localeCompare(a)), actions }
}

export const getTenderAdvisorPersonalActivity = (wsUserId: string | null, month: string) =>
  getPersonalActivity('advisor', wsUserId, month)

export const getTenderDigestPersonalActivity = (wsUserId: string | null, month: string) =>
  getPersonalActivity('digest', wsUserId, month)

export interface TenderUserActivity {
  email: string
  name: string
  events: number
  days: number
}

export interface TenderMonthActivity {
  events: number
  users: number
  unmatchedEvents: number
  lastSyncedAt: string | null
  actions: Record<string, number>
  people: TenderUserActivity[]
  unresolved: Array<{ sourceId: string; name: string; events: number }>
}

export async function getTenderMonthActivity(project: TenderProject, month: string): Promise<TenderMonthActivity> {
  const actions: Record<string, number> = {}
  const people = new Map<string, { email: string; name: string; events: number; days: Set<string> }>()
  const unresolved = new Map<string, { name: string; events: number }>()
  let events = 0
  let unmatchedEvents = 0
  let lastSyncedAt: string | null = null
  for (const row of await loadUsageRows(project, month)) {
    actions[row.action] = (actions[row.action] ?? 0) + row.event_count
    events += row.event_count
    if (!lastSyncedAt || row.synced_at > lastSyncedAt) lastSyncedAt = row.synced_at
    if (!row.ws_user_id) {
      unmatchedEvents += row.event_count
      const previous = unresolved.get(row.alias_key) ?? { name: row.alias_name ?? '', events: 0 }
      previous.events += row.event_count
      unresolved.set(row.alias_key, previous)
      continue
    }
    const person = people.get(row.ws_user_id) ?? {
      email: row.user_email ?? '', name: row.user_name ?? row.alias_name ?? row.alias_key, events: 0, days: new Set<string>(),
    }
    person.events += row.event_count
    person.days.add(row.work_date)
    people.set(row.ws_user_id, person)
  }
  const peopleList = [...people.values()]
    .map((person) => ({ email: person.email, name: person.name, events: person.events, days: person.days.size }))
    .sort((a, b) => b.days - a.days || b.events - a.events || a.name.localeCompare(b.name, 'ru'))
  return {
    events, users: peopleList.length,
    unmatchedEvents, lastSyncedAt, actions, people: peopleList,
    unresolved: [...unresolved.entries()].map(([sourceId, value]) => ({ sourceId, ...value }))
      .sort((a, b) => b.events - a.events),
  }
}
