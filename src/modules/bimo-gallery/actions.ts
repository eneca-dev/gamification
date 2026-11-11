'use server'

import { revalidatePath } from 'next/cache'

import { getCurrentUser } from '@/modules/auth'
import { createSupabaseAdminClient } from '@/config/supabase'
import { bimoEnabled } from '@/modules/profile-appearance/queries'
import type { ActionResult } from '@/modules/cache'

import { likeInputSchema, type LikeResult } from './types'

const errors: Record<string, string> = {
  bimo_likes_exhausted: 'Лайки на этот месяц закончились',
  bimo_self_like: 'Своего Бимо лайкнуть нельзя',
  bimo_month_closed: 'Месяц уже закрыт',
  bimo_no_look: 'У этого Бимо ещё нет образа',
  bimo_target_inactive: 'Сотрудник больше не участвует',
  bimo_voter_inactive: 'Ваша учётная запись неактивна',
  bimo_bad_input: 'Неверный запрос',
}

function message(raw: string) {
  return Object.entries(errors).find(([code]) => raw.includes(code))?.[1]
    ?? 'Не удалось сохранить голос. Попробуйте ещё раз'
}

interface LikeRpcResult {
  target_id?: string
  likes?: number
  liked?: boolean
  remaining?: number
}

async function vote(rpc: 'fn_bimo_like' | 'fn_bimo_unlike', input: unknown): Promise<ActionResult<LikeResult>> {
  const parsed = likeInputSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Неверный запрос' }

  const user = await getCurrentUser()
  if (!user?.wsUserId) return { success: false, error: 'Войдите в систему' }
  if (!bimoEnabled()) return { success: false, error: 'Галерея пока недоступна' }

  const { data, error } = await createSupabaseAdminClient().rpc(rpc, {
    p_voter_id: user.wsUserId,
    p_target_id: parsed.data.targetId,
  })
  if (error) return { success: false, error: message(error.message) }

  const result = (data ?? {}) as LikeRpcResult
  revalidatePath('/bimo')

  return {
    success: true,
    data: {
      targetId: result.target_id ?? parsed.data.targetId,
      likes: Number(result.likes ?? 0),
      liked: result.liked === true,
      remaining: Number(result.remaining ?? 0),
    },
  }
}

export async function likeBimo(input: unknown): Promise<ActionResult<LikeResult>> {
  return vote('fn_bimo_like', input)
}

export async function unlikeBimo(input: unknown): Promise<ActionResult<LikeResult>> {
  return vote('fn_bimo_unlike', input)
}
