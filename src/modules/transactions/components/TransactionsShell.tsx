'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { TransactionsFilters } from './TransactionsFilters'
import { TransactionsList } from './TransactionsList'
import type { TransactionItem } from './TransactionsList'

interface TransactionsShellProps {
  currentSort: string
  currentSource: string
  currentDateFrom: string
  currentDateTo: string
  sortHref: string
  items: TransactionItem[]
}

export function TransactionsShell({
  currentSort,
  currentSource,
  currentDateFrom,
  currentDateTo,
  sortHref,
  items,
}: TransactionsShellProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const navigate = (url: string) => {
    startTransition(() => { router.push(url) })
  }

  return (
    <>
      <TransactionsFilters
        currentSort={currentSort}
        currentSource={currentSource}
        currentDateFrom={currentDateFrom}
        currentDateTo={currentDateTo}
        onNavigate={navigate}
      />
      <TransactionsList
        items={items}
        currentSort={currentSort}
        sortHref={sortHref}
        isPending={isPending}
        onNavigate={navigate}
      />
    </>
  )
}
