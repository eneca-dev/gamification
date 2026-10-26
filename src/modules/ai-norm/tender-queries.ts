import { createSupabaseAdminClient } from '@/config/supabase'

type TenderTable = 'ai_tender_advisor_events' | 'ai_tender_digest_events'

function nextMonth(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10)
}

export interface TenderPersonalActivity {
  events: number
  dates: string[]
  actions: Record<string, number>
}

async function getPersonalActivity(
  table: TenderTable,
  email: string,
  month: string,
  actionColumn: 'event_type' | 'action',
): Promise<TenderPersonalActivity> {
  if (!email.trim()) return { events: 0, dates: [], actions: {} }
  const supabase = createSupabaseAdminClient()
  const dates = new Set<string>()
  const actions: Record<string, number> = {}
  let events = 0
  for (let start = 0; ; start += 1000) {
    const { data, error } = await supabase.from(table)
      .select(`work_date, ${actionColumn}`)
      .eq('user_email', email.trim().toLowerCase())
      .gte('work_date', `${month}-01`)
      .lt('work_date', nextMonth(month))
      .order('source_index').order('source_id')
      .range(start, start + 999)
    if (error) throw new Error(`Unable to load ${table}: ${error.message}`)
    for (const row of data ?? []) {
      const date = String(row.work_date)
      const action = String(row[actionColumn as keyof typeof row])
      dates.add(date)
      actions[action] = (actions[action] ?? 0) + 1
      events++
    }
    if ((data?.length ?? 0) < 1000) break
  }
  return { events, dates: [...dates].sort((a, b) => b.localeCompare(a)), actions }
}

export const getTenderAdvisorPersonalActivity = (email: string, month: string) =>
  getPersonalActivity('ai_tender_advisor_events', email, month, 'event_type')

export const getTenderDigestPersonalActivity = (email: string, month: string) =>
  getPersonalActivity('ai_tender_digest_events', email, month, 'action')

export interface TenderUserActivity {
  email: string
  name: string
  events: number
  days: number
}

export interface TenderMonthActivity {
  events: number
  users: number
  qualifyingUsers: number
  unmatchedEvents: number
  lastSyncedAt: string | null
  actions: Record<string, number>
  people: TenderUserActivity[]
  unresolved: Array<{ sourceId: string; name: string; status: string; events: number }>
}

export async function getTenderMonthActivity(table: TenderTable, month: string): Promise<TenderMonthActivity> {
  const supabase = createSupabaseAdminClient()
  const isDigest = table === 'ai_tender_digest_events'
  const columns = isDigest
    ? 'user_email, user_name, work_date, action, digest_user_id, match_status, synced_at'
    : 'user_email, user_name, work_date, event_type, synced_at'
  const actions: Record<string, number> = {}
  const people = new Map<string, { name: string; events: number; days: Set<string> }>()
  const unresolved = new Map<string, { name: string; status: string; events: number }>()
  let events = 0
  let unmatchedEvents = 0
  let lastSyncedAt: string | null = null
  for (let start = 0; ; start += 1000) {
    const { data, error } = await supabase.from(table)
      .select(columns)
      .gte('work_date', `${month}-01`)
      .lt('work_date', nextMonth(month))
      .order('source_index').order('source_id')
      .range(start, start + 999)
    if (error) throw new Error(`Unable to load ${table}: ${error.message}`)
    for (const row of data ?? []) {
      const entry = row as unknown as Record<string, unknown>
      const action = String(entry[isDigest ? 'action' : 'event_type'])
      actions[action] = (actions[action] ?? 0) + 1
      events++
      const syncedAt = String(entry.synced_at ?? '')
      if (syncedAt && (!lastSyncedAt || syncedAt > lastSyncedAt)) lastSyncedAt = syncedAt
      const email = typeof entry.user_email === 'string' ? entry.user_email.toLowerCase() : ''
      if (!email) {
        unmatchedEvents++
        const sourceId = String(entry.digest_user_id ?? '')
        const previous = unresolved.get(sourceId) ?? {
          name: String(entry.user_name ?? ''), status: String(entry.match_status ?? 'unmatched'), events: 0,
        }
        previous.events++
        unresolved.set(sourceId, previous)
        continue
      }
      const person = people.get(email) ?? {
        name: String(entry.user_name ?? email), events: 0, days: new Set<string>(),
      }
      person.events++
      person.days.add(String(entry.work_date))
      people.set(email, person)
    }
    if ((data?.length ?? 0) < 1000) break
  }
  const peopleList = [...people.entries()]
    .map(([email, value]) => ({ email, name: value.name, events: value.events, days: value.days.size }))
    .sort((a, b) => b.days - a.days || b.events - a.events || a.name.localeCompare(b.name, 'ru'))
  return {
    events, users: people.size, qualifyingUsers: peopleList.filter((person) => person.days >= 1).length,
    unmatchedEvents, lastSyncedAt, actions, people: peopleList,
    unresolved: [...unresolved.entries()].map(([sourceId, value]) => ({ sourceId, ...value }))
      .sort((a, b) => b.events - a.events),
  }
}
