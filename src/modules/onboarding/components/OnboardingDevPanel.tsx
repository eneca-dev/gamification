'use client'

import { useEffect, useRef, useState } from 'react'
import { Play, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'

import { TOURS, useOnboardingContext } from './OnboardingProvider'
import { resetAllTours, resetTour } from '../storage'
import { getPageSlugWithFallback, getPathForSlug } from '../page-slug'

interface OnboardingDevPanelProps {
  userId: string
}

/**
 * Человекочитаемые подписи слугов. Список самих туров берётся из реестра
 * `TOURS` — новые туры появляются в панели автоматически; при отсутствии
 * подписи показывается сам slug.
 */
const SLUG_LABELS: Record<string, string> = {
  dashboard: 'Главная',
  achievements: 'Достижения',
  store: 'Магазин',
  activity: 'Активность',
  transactions: 'Транзакции',
  help: 'Помощь',
  admin: 'Админ',
  'admin-users': 'Пользователи (адм)',
  'admin-products': 'Товары (адм)',
  'admin-orders': 'Заказы (адм)',
  'admin-events': 'События (адм)',
  'admin-calendar': 'Календарь (адм)',
  'admin-achievements': 'Достижения (адм)',
  'admin-help': 'Справка (адм)',
  'admin-help-edit': 'Редактор справки (адм)',
  'admin-day-off': 'Отгулы (адм)',
  'admin-economy': 'Экономика (адм)',
  'admin-feedback': 'Обратная связь (адм)',
  'admin-chatbot': 'Чат-бот (адм)',
  'admin-shields': 'Щиты (адм)',
}

export function OnboardingDevPanel({ userId }: OnboardingDevPanelProps) {
  const [open, setOpen] = useState(false)
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null)
  const { startTour } = useOnboardingContext()
  const pathname = usePathname()
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)

  const currentSlug = getPageSlugWithFallback(pathname)

  // Клик вне панели — закрыть меню выбора
  useEffect(() => {
    if (!open) return
    function handleOutside(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  function handleStart(slug: string, stepIndex = 0) {
    resetTour(userId, slug)
    // Не на нужной странице — сначала переходим на неё.
    // Spotlight поллит target до 3с, поэтому тур стартует сразу.
    if (slug !== currentSlug) {
      const path = getPathForSlug(slug)
      if (path) router.push(path)
    }
    startTour(slug, stepIndex)
    setOpen(false)
  }

  function handleResetAll() {
    resetAllTours(userId)
  }

  return (
    <div ref={containerRef} className="fixed bottom-4 right-4 z-[9999] flex flex-col items-end gap-2">
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

          <div className="flex flex-col gap-1 overflow-y-auto max-h-[60vh] -mx-1 px-1">
          {TOURS.map(({ pageSlug: slug, steps }) => {
            const label = SLUG_LABELS[slug] ?? slug
            const isExpanded = expandedSlug === slug
            return (
              <div key={slug} className="flex flex-col">
                <div
                  className="flex items-center w-full rounded-lg transition-colors hover:bg-black/5"
                  style={{ color: slug === currentSlug ? 'var(--apex-primary)' : 'var(--apex-text)' }}
                >
                  <button
                    onClick={() => handleStart(slug)}
                    className="flex items-center gap-1.5 flex-1 min-w-0 px-2 py-1.5 text-[12px] text-left"
                  >
                    <Play size={11} className="opacity-50 flex-shrink-0" />
                    <span className="truncate">{label}</span>
                  </button>
                  {steps.length > 1 && (
                    <button
                      onClick={() => setExpandedSlug(isExpanded ? null : slug)}
                      className="px-1.5 py-1.5 flex-shrink-0"
                      style={{ color: 'var(--text-muted)' }}
                      aria-label="Показать шаги"
                    >
                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  )}
                </div>

                {isExpanded && (
                  <div className="flex flex-col pl-2.5 mt-0.5 mb-1 ml-1.5" style={{ borderLeft: '1px solid var(--apex-border)' }}>
                    {steps.map((step, i) => (
                      <button
                        key={step.id}
                        onClick={() => handleStart(slug, i)}
                        className="flex items-start gap-1.5 w-full px-2 py-1 rounded-lg text-[11px] text-left transition-colors hover:bg-black/5"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        <span className="opacity-60 flex-shrink-0 tabular-nums">{i + 1}.</span>
                        <span className="truncate">{step.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          </div>

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
