'use server'

import { getCurrentUser } from '@/modules/auth/queries'
import type { Transaction } from '@/lib/data'

import { getDashboardTransactions } from './queries'

/** Загрузить последние операции (для TanStack Query). Только свои — email сверяется с сессией */
export async function fetchDashboardTransactions(userEmail: string, limit = 5): Promise<Transaction[]> {
  const currentUser = await getCurrentUser()
  if (!currentUser || currentUser.email.toLowerCase() !== userEmail.toLowerCase()) {
    return []
  }
  return getDashboardTransactions(userEmail, limit)
}
