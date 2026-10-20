'use server'

import { getCurrentUser } from '@/modules/auth/queries'
import { getMyGratitudesNew, getSenderQuota, getCompanyGratitudes } from './queries'

import type { GratitudeNew, SenderQuota } from './types'

/** Загрузить благодарности пользователя (для TanStack Query) */
export async function fetchMyGratitudes(userEmail: string, limit = 30): Promise<GratitudeNew[]> {
  const user = await getCurrentUser()
  if (!user || user.email.toLowerCase() !== userEmail.toLowerCase()) {
    throw new Error('Доступ запрещён')
  }
  return getMyGratitudesNew(user.email, Math.min(Math.max(Math.trunc(limit) || 1, 1), 100))
}

/** Загрузить ленту компании за 2 недели (для TanStack Query) */
export async function fetchCompanyGratitudes(limit = 100): Promise<GratitudeNew[]> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Доступ запрещён')
  const since = new Date()
  since.setDate(since.getDate() - 14)
  return getCompanyGratitudes(since.toISOString(), Math.min(Math.max(Math.trunc(limit) || 1, 1), 100))
}

/** Загрузить квоту отправителя (для TanStack Query) */
export async function fetchSenderQuota(senderId: string): Promise<SenderQuota> {
  const user = await getCurrentUser()
  if (!user?.wsUserId || user.wsUserId !== senderId) {
    throw new Error('Доступ запрещён')
  }
  return getSenderQuota(user.wsUserId)
}
