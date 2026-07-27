import { createSupabaseAdminClient } from '@/config/supabase'

import type { ExportOptions } from './types'

// Списки для панели выгрузки: активные сотрудники (для поиска) и отделы.
export async function getExportOptions(): Promise<ExportOptions> {
  const supabase = createSupabaseAdminClient()
  const { data } = await supabase
    .from('ws_users')
    .select('id, first_name, last_name, department')
    .eq('is_active', true)
    .order('last_name')

  const rows = data ?? []
  const employees = rows.map((u) => ({
    id: u.id as string,
    name: `${u.last_name ?? ''} ${u.first_name ?? ''}`.trim(),
    department: (u.department as string) ?? '—',
  }))
  const departments = [...new Set(rows.map((u) => (u.department as string) ?? '—'))].sort((a, b) =>
    a.localeCompare(b, 'ru'),
  )
  return { employees, departments }
}
