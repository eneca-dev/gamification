'use client'

import { Lock } from 'lucide-react'

import { signOut } from '@/modules/auth/index.client'

export function BetaAccessDenied() {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-8"
      style={{ background: 'var(--apex-bg)' }}
    >
      <div
        className="max-w-sm w-full rounded-2xl p-8 text-center"
        style={{
          background: 'var(--apex-surface)',
          border: '1px solid var(--apex-border)',
        }}
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: 'var(--apex-success-bg)' }}
        >
          <Lock size={24} style={{ color: 'var(--apex-primary)' }} />
        </div>
        <h1 className="text-[18px] font-extrabold mb-2" style={{ color: 'var(--apex-text)' }}>
          Доступ ограничен
        </h1>
        <p className="text-[13px] font-medium mb-6" style={{ color: 'var(--apex-text-secondary)' }}>
          Приложение находится в режиме бета-тестирования. Обратитесь к администратору для получения доступа.
        </p>
        <form action={signOut}>
          <button
            type="submit"
            className="px-6 py-2.5 rounded-full text-[13px] font-bold text-white transition-colors"
            style={{ background: 'var(--apex-primary)' }}
          >
            Выйти
          </button>
        </form>
      </div>
    </div>
  )
}
