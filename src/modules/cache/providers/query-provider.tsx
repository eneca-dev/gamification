'use client'

import { useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { createQueryClient } from '../client/query-client'
import { RealtimeSync } from '../realtime/realtime-sync'

interface QueryProviderProps {
  children: React.ReactNode
  disableRealtime?: boolean
}

export function QueryProvider({ children, disableRealtime = false }: QueryProviderProps) {
  const [queryClient] = useState(() => createQueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      {!disableRealtime && <RealtimeSync />}
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
