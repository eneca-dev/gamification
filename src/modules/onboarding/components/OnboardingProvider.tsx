'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

import { OnboardingSpotlight } from './OnboardingSpotlight'
import { isTourSeen, markTourSeen, resetTour, resetAllTours } from '../storage'
import { dashboardTour } from '../tours/dashboard'
import { achievementsTour } from '../tours/achievements'
import { storeTour } from '../tours/store'
import { activityTour } from '../tours/activity'
import { adminTour } from '../tours/admin'
import { adminUsersTour } from '../tours/admin-users'
import { adminProductsTour } from '../tours/admin-products'
import { adminOrdersTour } from '../tours/admin-orders'
import { adminEventsTour } from '../tours/admin-events'
import { adminCalendarTour } from '../tours/admin-calendar'
import { adminAchievementsTour } from '../tours/admin-achievements'
import { adminLotteryTour } from '../tours/admin-lottery'
import type { OnboardingStep, OnboardingTour } from '../types'

const TOURS: OnboardingTour[] = [
  dashboardTour, achievementsTour, storeTour, activityTour,
  adminTour, adminUsersTour, adminProductsTour, adminOrdersTour,
  adminEventsTour, adminCalendarTour, adminAchievementsTour, adminLotteryTour,
]

/** Маппинг pathname → pageSlug */
const PAGE_SLUG_MAP: Record<string, string> = {
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
}

function getPageSlug(pathname: string): string | null {
  return PAGE_SLUG_MAP[pathname] ?? null
}

interface OnboardingContextValue {
  /** Принудительно запустить тур для текущей страницы */
  startTour: (pageSlug: string) => void
}

const OnboardingContext = createContext<OnboardingContextValue>({
  startTour: () => {},
})

export function useOnboardingContext() {
  return useContext(OnboardingContext)
}

/** Задержка перед запуском тура (мс) — ждём рендер виджетов */
const START_DELAY = 1500

interface OnboardingProviderProps {
  userId: string
  children: React.ReactNode
}

export function OnboardingProvider({ userId, children }: OnboardingProviderProps) {
  const pathname = usePathname()
  const [activeTour, setActiveTour] = useState<OnboardingTour | null>(null)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)

  // Dev mode: обработка URL параметров ?onboarding=reset / reset:slug / start:slug
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return
    const params = new URLSearchParams(window.location.search)
    const param = params.get('onboarding')
    if (!param) return

    // Очищаем URL чтобы параметр не сработал повторно
    params.delete('onboarding')
    const newUrl = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname
    window.history.replaceState({}, '', newUrl)

    if (param === 'reset') {
      resetAllTours(userId)
    } else if (param.startsWith('reset:')) {
      const slug = param.slice(6)
      resetTour(userId, slug)
    } else if (param.startsWith('start:')) {
      const slug = param.slice(6)
      const tour = TOURS.find((t) => t.pageSlug === slug)
      if (tour) {
        setActiveTour(tour)
        setCurrentStepIndex(0)
      }
    }
  }, [pathname, userId])

  // Автозапуск тура при смене страницы
  useEffect(() => {
    const slug = getPageSlug(pathname)
    if (!slug) return

    // Если тур уже показан — не запускаем
    if (isTourSeen(userId, slug)) return

    const tour = TOURS.find((t) => t.pageSlug === slug)
    if (!tour) return

    // Ждём рендер виджетов
    const timer = setTimeout(() => {
      // Повторная проверка (race condition с другими табами)
      if (isTourSeen(userId, slug)) return

      markTourSeen(userId, slug)
      setActiveTour(tour)
      setCurrentStepIndex(0)
    }, START_DELAY)

    return () => clearTimeout(timer)
  }, [pathname, userId])

  const handleNext = useCallback(() => {
    if (!activeTour) return

    const nextIndex = currentStepIndex + 1
    if (nextIndex >= activeTour.steps.length) {
      // Тур завершён
      setActiveTour(null)
      setCurrentStepIndex(0)
    } else {
      setCurrentStepIndex(nextIndex)
    }
  }, [activeTour, currentStepIndex, userId])

  const handleSkip = useCallback(() => {
    if (!activeTour) return
    setActiveTour(null)
    setCurrentStepIndex(0)
  }, [activeTour, userId])

  const startTour = useCallback((pageSlug: string) => {
    const tour = TOURS.find((t) => t.pageSlug === pageSlug)
    if (!tour) return
    markTourSeen(userId, pageSlug)
    setActiveTour(tour)
    setCurrentStepIndex(0)
  }, [userId])

  const currentStep: OnboardingStep | null = activeTour?.steps[currentStepIndex] ?? null

  return (
    <OnboardingContext.Provider value={{ startTour }}>
      {children}
      {activeTour && currentStep && (
        <OnboardingSpotlight
          step={currentStep}
          stepIndex={currentStepIndex}
          totalSteps={activeTour.steps.length}
          onNext={handleNext}
          onSkip={handleSkip}
        />
      )}
    </OnboardingContext.Provider>
  )
}
