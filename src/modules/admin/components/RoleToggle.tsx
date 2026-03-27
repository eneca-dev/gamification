'use client'

import { createContext, useContext, useTransition, useState } from 'react'

import { toggleAdmin } from '@/modules/admin/index.client'

interface RoleContextValue {
  isAdmin: boolean
  isPending: boolean
  error: string | null
  handleToggle: () => void
}

const RoleContext = createContext<RoleContextValue | null>(null)

function useRoleContext() {
  const ctx = useContext(RoleContext)
  if (!ctx) throw new Error('useRoleContext must be used within RoleProvider')
  return ctx
}

interface RoleProviderProps {
  userId: string
  initialIsAdmin: boolean
  children: React.ReactNode
}

export function RoleProvider({ userId, initialIsAdmin, children }: RoleProviderProps) {
  const [isAdmin, setIsAdmin] = useState(initialIsAdmin)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleToggle() {
    const prev = isAdmin
    setIsAdmin(!prev)
    setError(null)

    startTransition(async () => {
      const result = await toggleAdmin(userId)
      if (!result.success) {
        setIsAdmin(prev)
        setError(result.error)
      }
    })
  }

  return (
    <RoleContext.Provider value={{ isAdmin, isPending, error, handleToggle }}>
      {children}
    </RoleContext.Provider>
  )
}

export function RoleBadge() {
  const { isAdmin } = useRoleContext()

  return (
    <span
      className="text-[11px] font-semibold px-3 py-1 rounded-full transition-colors duration-200"
      style={{
        background: isAdmin ? 'var(--apex-success-bg)' : 'var(--apex-bg)',
        color: isAdmin ? 'var(--apex-primary)' : 'var(--apex-text-muted)',
      }}
    >
      {isAdmin ? 'Админ' : 'Пользователь'}
    </span>
  )
}

export function RoleSwitch() {
  const { isAdmin, isPending, error, handleToggle } = useRoleContext()

  return (
    <div className="flex items-center gap-3">
      <button
        role="switch"
        aria-checked={isAdmin}
        aria-label="Переключить роль админа"
        onClick={handleToggle}
        disabled={isPending}
        className="relative w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none"
        style={{
          background: isAdmin ? 'var(--apex-primary)' : 'var(--apex-border)',
          opacity: isPending ? 0.6 : 1,
        }}
      >
        <span
          className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
          style={{
            transform: isAdmin ? 'translateX(16px)' : 'translateX(0)',
          }}
        />
      </button>
      <span
        className="text-[13px] font-semibold transition-colors duration-200"
        style={{ color: isAdmin ? 'var(--apex-text)' : 'var(--apex-text-muted)' }}
      >
        Администратор
      </span>
      {error && (
        <span className="text-[11px]" style={{ color: 'var(--apex-danger)' }}>
          {error}
        </span>
      )}
    </div>
  )
}
