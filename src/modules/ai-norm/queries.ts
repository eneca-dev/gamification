import { createSupabaseAdminClient } from '@/config/supabase'

interface NormCheckRow {
  user_email: string
  work_date: string
  mode: string
}

export function getMinskMonth(): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Minsk', year: 'numeric', month: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}`
}

function nextMonth(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10)
}

export interface NormPersonalActivity {
  checks: number
  dates: string[]
}

export async function getNormPersonalActivity(email: string, month: string): Promise<NormPersonalActivity> {
  if (!email.trim()) return { checks: 0, dates: [] }

  const supabase = createSupabaseAdminClient()
  const dates = new Set<string>()
  let checks = 0

  for (let start = 0; ; start += 1000) {
    const { data, error } = await supabase
      .from('ai_norm_checks')
      .select('work_date')
      .eq('user_email', email.trim().toLowerCase())
      .gte('work_date', `${month}-01`)
      .lt('work_date', nextMonth(month))
      .order('id')
      .range(start, start + 999)
    if (error) throw new Error(`Не удалось загрузить личные проверки нормоконтроля: ${error.message}`)
    checks += data?.length ?? 0
    for (const row of data ?? []) dates.add(row.work_date)
    if ((data?.length ?? 0) < 1000) break
  }

  return { checks, dates: [...dates].sort((a, b) => b.localeCompare(a)) }
}

export interface NormUserActivity {
  email: string
  name: string
  checks: number
  days: number
  lastDate: string
}

export interface NormMonthActivity {
  checks: number
  users: number
  days: number
  userDays: number
  modes: Array<{ mode: string; checks: number }>
  people: NormUserActivity[]
}

export async function getNormMonthActivity(month: string): Promise<NormMonthActivity> {
  const supabase = createSupabaseAdminClient()
  const from = `${month}-01`
  const to = nextMonth(month)
  const rows: NormCheckRow[] = []

  for (let start = 0; ; start += 1000) {
    const { data, error } = await supabase
      .from('ai_norm_checks')
      .select('user_email, work_date, mode')
      .gte('work_date', from)
      .lt('work_date', to)
      .order('id')
      .range(start, start + 999)
    if (error) throw new Error(`Не удалось загрузить проверки нормоконтроля: ${error.message}`)
    rows.push(...(data ?? []))
    if ((data?.length ?? 0) < 1000) break
  }

  const activeDates = new Set<string>()
  const userDays = new Set<string>()
  const modeCounts = new Map<string, number>()
  const byEmail = new Map<string, { checks: number; dates: Set<string>; lastDate: string }>()

  for (const row of rows) {
    const email = row.user_email.toLowerCase()
    activeDates.add(row.work_date)
    userDays.add(`${email}|${row.work_date}`)
    modeCounts.set(row.mode, (modeCounts.get(row.mode) ?? 0) + 1)
    const user = byEmail.get(email) ?? { checks: 0, dates: new Set<string>(), lastDate: row.work_date }
    user.checks++
    user.dates.add(row.work_date)
    if (row.work_date > user.lastDate) user.lastDate = row.work_date
    byEmail.set(email, user)
  }

  const emails = [...byEmail.keys()]
  const names = new Map<string, string>()
  if (emails.length > 0) {
    const { data, error } = await supabase
      .from('ws_users')
      .select('email, first_name, last_name')
      .in('email', emails)
    if (error) throw new Error(`Не удалось загрузить сотрудников: ${error.message}`)
    for (const user of data ?? []) {
      const name = [user.first_name, user.last_name].filter(Boolean).join(' ')
      names.set(user.email.toLowerCase(), name || user.email)
    }
  }

  const people = [...byEmail.entries()]
    .map(([email, value]) => ({
      email,
      name: names.get(email) ?? email,
      checks: value.checks,
      days: value.dates.size,
      lastDate: value.lastDate,
    }))
    .sort((a, b) => b.days - a.days || b.checks - a.checks || a.name.localeCompare(b.name, 'ru'))

  const modes = [...modeCounts.entries()]
    .map(([mode, checks]) => ({ mode, checks }))
    .sort((a, b) => b.checks - a.checks || a.mode.localeCompare(b.mode))

  return { checks: rows.length, users: byEmail.size, days: activeDates.size, userDays: userDays.size, modes, people }
}
