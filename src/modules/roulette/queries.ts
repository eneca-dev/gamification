import { createSupabaseAdminClient } from '@/config/supabase'
import { z } from 'zod'

export async function getRouletteEnabled(): Promise<boolean | null> {
  try {
    const { data, error } = await createSupabaseAdminClient().from('roulette_settings').select('enabled').eq('singleton', true).maybeSingle()
    return error ? null : data?.enabled === true
  } catch { return null }
}
const statsSchema = z.object({
  spins: z.number().int().safe().nonnegative(), players: z.number().int().safe().nonnegative(),
  bets: z.number().int().safe().nonnegative(), balancesAfter: z.number().int().safe().nonnegative(), delta: z.number().int().safe(),
  zeroShare: z.number().min(0).max(1),
})
export async function getRouletteStats(from: string | null, to: string | null) {
  const { data, error } = await createSupabaseAdminClient().rpc('get_roulette_stats', { p_from: from, p_to: to })
  if (error) throw new Error('Не удалось загрузить статистику рулетки')
  return statsSchema.parse(data)
}
