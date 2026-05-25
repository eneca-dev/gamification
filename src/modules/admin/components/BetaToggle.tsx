'use client'

import { createContext, useContext, useTransition, useState } from 'react'

import { toggleBetaTester } from '@/modules/admin/index.client'

interface BetaContextValue {
  isBeta: boolean
  isPending: boolean
  error: string | null
  handleToggle: () => void
}

const BetaContext = createContext<BetaContextValue | null>(null)

function useBetaContext() {
  const ctx = useContext(BetaContext)
  if (!ctx) throw new Error('useBetaContext must be used within BetaProvider')
  return ctx
}

interface BetaProviderProps {
  userId: string
  initialIsBeta: boolean
  children: React.ReactNode
}

export function BetaProvider({ userId, initialIsBeta, children }: BetaProviderProps) {
  const [isBeta, setIsBeta] = useState(initialIsBeta)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleToggle() {
    const prev = isBeta
    setIsBeta(!prev)
    setError(null)

    startTransition(async () => {
      const result = await toggleBetaTester(userId)
      if (!result.success) {
        setIsBeta(prev)
        setError(result.error)
      }
    })
  }

  return (
    <BetaContext.Provider value={{ isBeta, isPending, error, handleToggle }}>
      {children}
    </BetaContext.Provider>
  )
}

export function BetaSwitch() {
  const { isBeta, isPending, error, handleToggle } = useBetaContext()

  return (
    <div className="flex items-center gap-3">
      <button
        role="switch"
        aria-checked={isBeta}
        aria-label="Переключить бета-тестирование"
        onClick={handleToggle}
        disabled={isPending}
        className="relative w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none"
        style={{
          background: isBeta ? 'var(--apex-primary)' : 'var(--apex-border)',
          opacity: isPending ? 0.6 : 1,
        }}
      >
        <span
          className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
          style={{ transform: isBeta ? 'translateX(16px)' : 'translateX(0)' }}
        />
      </button>
      <span
        className="text-[13px] font-semibold transition-colors duration-200"
        style={{ color: isBeta ? 'var(--apex-text)' : 'var(--apex-text-muted)' }}
      >
        Бета
      </span>
      {error && (
        <span className="text-[11px]" style={{ color: 'var(--apex-danger)' }}>
          {error}
        </span>
      )}
    </div>
  )
}
