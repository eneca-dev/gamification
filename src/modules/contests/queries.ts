import { createSupabaseAdminClient } from '@/config/supabase'
import { cached, CACHE_5M } from '@/lib/server-cache'

import type { ContestWinner, ContestType } from './types'
import { CONTEST_EVENT_KEYS } from './types'

const EVENT_KEY_TO_TYPE = Object.fromEntries(
  Object.entries(CONTEST_EVENT_KEYS).map(([type, key]) => [key, type as ContestType])
)

async function _getContestWinners(limit = 6): Promise<ContestWinner[]> {
  const supabase = createSupabaseAdminClient()

  const { data, error } = await supabase
    .from('view_contest_monthly_winners')
    .select('event_type, contest_month, winner, contest_score')
    .order('contest_month', { ascending: false })
    .limit(limit * 4)

  if (error) {
    console.error('[contests] getContestWinners:', error.message)
    return []
  }

  return (data ?? [])
    .map((row) => {
      const contestType = EVENT_KEY_TO_TYPE[row.event_type as string]
      if (!contestType || !row.contest_month || !row.winner) return null
      return {
        contestMonth: row.contest_month as string,
        contestType,
        winner: row.winner as string,
        score: Number(row.contest_score ?? 0),
      }
    })
    .filter((w): w is ContestWinner => w !== null)
}

export const getContestWinners = (limit = 6) =>
  cached(() => _getContestWinners(limit), ['contest-winners', String(limit)], {
    tags: ['contests'], revalidate: CACHE_5M,
  })()
