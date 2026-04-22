'use client'

import { useState } from 'react'
import { Play, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react'
import { usePathname } from 'next/navigation'

import { useOnboardingContext } from './OnboardingProvider'
import { resetAllTours, resetTour } from '../storage'

interface OnboardingDevPanelProps {
  userId: string
}

const TOUR_PAGES = [
  { slug: 'dashboard', label: 'Главная' },
  { slug: 'achievements', label: 'Достижения' },
  { slug: 'store', label: 'Магазин' },
  { slug: 'activity', label: 'Активность' },
  { slug: 'help', label: 'Помощь' },
  { slug: 'master-planner', label: 'Мастер-планировщик' },
  { slug: 'admin', label: 'Админ' },
  { slug: 'admin-users', label: 'Пользователи (адм)' },
  { slug: 'admin-products', label: 'Товары (адм)' },
  { slug: 'admin-orders', label: 'Заказы (адм)' },
  { slug: 'admin-events', label: 'События (адм)' },
  { slug: 'admin-calendar', label: 'Календарь (адм)' },
  { slug: 'admin-achievements', label: 'Достижения (адм)' },
  { slug: 'admin-lottery', label: 'Лотерея (адм)' },
  { slug: 'admin-help', label: 'Справка (адм)' },
]

const PATH_TO_SLUG: Record<string, string> = {
  '/': 'dashboard',
  '/achievements': 'achievements',
  '/store': 'store',
  '/activity': 'activity',
  '/admin': 'admin',
  '/admin/users': 'admin-users',
  '/admin/products': 'admin-products',
  '/admin/orders': 'admin-orders',
  '/admin/events': 'admin-events',
  '/admin/calendar': 'admin-calendar',
  '/admin/achievements': 'admin-achievements',
  '/admin/lottery': 'admin-lottery',
  '/admin/help': 'admin-help',
  '/help': 'help',
  '/master-planner': 'master-planner',
}

export function OnboardingDevPanel({ userId }: OnboardingDevPanelProps) {
  const [open, setOpen] = useState(false)
  const { startTour } = useOnboardingContext()
  const pathname = usePathname()

  const currentSlug = PATH_TO_SLUG[pathname] ?? null

  function handleStart(slug: string) {
    resetTour(userId, slug)
    startTour(slug)
    setOpen(false)
  }

  function handleResetAll() {
    resetAllTours(userId)
  }

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col items-end gap-2">
      {open && (
        <div
          className="rounded-xl p-3 w-56 flex flex-col gap-1"
          style={{
            background: 'var(--surface-elevated)',
            border: '1px solid var(--apex-border)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          }}
        >
          <div className="text-[10px] font-semibold uppercase tracking-wider mb-1 px-1" style={{ color: 'var(--text-muted)' }}>
            Туры онбординга
          </div>

          {TOUR_PAGES.map(({ slug, label }) => (
            <button
              key={slug}
              onClick={() => handleStart(slug)}
              className="flex items-center justify-between w-full px-2 py-1.5 rounded-lg text-[12px] text-left transition-colors hover:bg-black/5"
              style={{ color: slug === currentSlug ? 'var(--apex-primary)' : 'var(--apex-text)' }}
            >
              <span>{label}</span>
              <Play size={11} className="opacity-50 flex-shrink-0" />
            </button>
          ))}

          <div className="border-t mt-1 pt-2" style={{ borderColor: 'var(--apex-border)' }}>
            <button
              onClick={handleResetAll}
              className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded-lg text-[11px] transition-colors hover:bg-black/5"
              style={{ color: 'var(--text-muted)' }}
            >
              <RotateCcw size={11} />
              Сбросить все туры
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors"
        style={{
          background: 'var(--apex-primary)',
          color: '#fff',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        }}
      >
        OB
        {open ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
      </button>
    </div>
  )
}
