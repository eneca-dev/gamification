import { createSupabaseAdminClient } from '@/config/supabase'

/** Authoritative read: an absent new employee balance is zero, a failed read is not. */
export async function readUserBalance(wsUserId: string): Promise<number> {
  const { data, error } = await createSupabaseAdminClient()
    .from('gamification_balances')
    .select('total_coins')
    .eq('user_id', wsUserId)
    .maybeSingle()

  if (error) throw new Error('Не удалось загрузить актуальный баланс')
  if (data === null) return 0
  if (!Number.isSafeInteger(data.total_coins)) {
    throw new Error('Некорректный ответ при чтении баланса')
  }
  return data.total_coins
}
