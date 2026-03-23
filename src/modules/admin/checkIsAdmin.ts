import { createSupabaseServerClient } from '@/config/supabase'

/**
 * Проверяет is_admin из JWT access_token.
 * Используется в Server Actions для защиты админских мутаций.
 * Custom claims из hook доступны только через декодирование JWT —
 * ни getUser(), ни getSession().user.app_metadata их не содержат.
 */
export async function checkIsAdmin(): Promise<boolean> {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.access_token) return false

  try {
    const payload = JSON.parse(
      Buffer.from(session.access_token.split('.')[1], 'base64').toString()
    )
    return payload.is_admin === true || payload.app_metadata?.is_admin === true
  } catch {
    return false
  }
}
