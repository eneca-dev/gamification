'use client'

import { TransactionFeed } from '@/components/dashboard/TransactionFeed'

import { useRecentTransactions } from '../hooks/useTransactions'

import type { Transaction } from '@/lib/data'

interface LiveTransactionFeedProps {
  userEmail: string
  initialTransactions: Transaction[]
}

/** Live-обёртка над TransactionFeed: серверный initialData + realtime-обновления */
export function LiveTransactionFeed({ userEmail, initialTransactions }: LiveTransactionFeedProps) {
  const { data: transactions = initialTransactions } = useRecentTransactions(userEmail, initialTransactions)

  return <TransactionFeed transactions={transactions} />
}
