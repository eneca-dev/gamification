'use server'

import { getMyGratitudesNew, getSenderQuota, getCompanyGratitudes } from './queries'

import type { GratitudeNew, SenderQuota } from './types'

/** Загрузить благодарности пользователя (для TanStack Query) */
export async function fetchMyGratitudes(userEmail: string, limit = 30): Promise<GratitudeNew[]> {
  return getMyGratitudesNew(userEmail, limit)
}

/** Загрузить ленту компании за 2 недели (для TanStack Query) */
export async function fetchCompanyGratitudes(limit = 100): Promise<GratitudeNew[]> {
  const since = new Date()
  since.setDate(since.getDate() - 14)
  return getCompanyGratitudes(since.toISOString(), limit)
}

/** Загрузить квоту отправителя (для TanStack Query) */
export async function fetchSenderQuota(senderId: string): Promise<SenderQuota> {
  return getSenderQuota(senderId)
}
