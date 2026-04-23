import { createSupabaseAdminClient } from '@/config/supabase'

import type { DevUser } from './types'

const DEV_TOOLS_ENABLED =
  process.env.NODE_ENV === 'development' ||
  process.env.ENABLE_DEV_TOOLS === 'true'

/**
 * Поиск пользователей в ws_users для dev-переключателя.
 * Возвращает до `limit` активных пользователей, отфильтрованных по поисковому запросу.
 */
export async function searchDevUsers(
  search: string,
  limit = 30
): Promise<DevUser[]> {
  if (!DEV_TOOLS_ENABLED) return []

  const supabase = createSupabaseAdminClient()

  let query = supabase
    .from('ws_users')
    .select('id, email, first_name, last_name, department, department_code, team')
    .eq('is_active', true)
    .order('last_name', { ascending: true })
    .limit(limit)

  if (search.trim()) {
    const term = `%${search.trim()}%`
    query = query.or(
      `first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term}`
    )
  }

  const { data, error } = await query

  if (error || !data) return []

  return data.map((u) => ({
    id: u.id,
    email: u.email,
    firstName: u.first_name,
    lastName: u.last_name,
    fullName: `${u.first_name} ${u.last_name}`.trim(),
    department: u.department ?? null,
    departmentCode: u.department_code ?? null,
    team: u.team ?? null,
  }))
}

/**
 * Получить данные одного пользователя из ws_users по email.
 * Используется в getCurrentUser() при impersonation.
 */
export async function getDevUserByEmail(
  email: string
): Promise<DevUser | null> {
  if (!DEV_TOOLS_ENABLED) return null

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('ws_users')
    .select('id, email, first_name, last_name, department, department_code, team')
    .eq('email', email.toLowerCase())
    .eq('is_active', true)
    .single()

  if (error || !data) return null

  return {
    id: data.id,
    email: data.email,
    firstName: data.first_name,
    lastName: data.last_name,
    fullName: `${data.first_name} ${data.last_name}`.trim(),
    department: data.department ?? null,
    departmentCode: data.department_code ?? null,
    team: data.team ?? null,
  }
}
