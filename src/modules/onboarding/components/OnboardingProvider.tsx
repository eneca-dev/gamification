'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

import { OnboardingSpotlight } from './OnboardingSpotlight'
import { OnboardingDevPanel } from './OnboardingDevPanel'
import { isTourSeen, markTourSeen, resetTour, resetAllTours } from '../storage'
import { getOnboardingSeenSlugs, markTourSeenInDb } from '../actions'
import { getPageSlug } from '../page-slug'
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
import { adminHelpTour } from '../tours/admin-help'
import { helpTour } from '../tours/help'
import { masterPlannerTour } from '../tours/master-planner'
import type { OnboardingStep, OnboardingTour } from '../types'

const TOURS: OnboardingTour[] = [
  dashboardTour, achievementsTour, storeTour, activityTour,
  adminTour, adminUsersTour, adminProductsTour, adminOrdersTour,
  adminEventsTour, adminCalendarTour, adminAchievementsTour, adminLotteryTour,
  adminHelpTour, helpTour, masterPlannerTour,
]

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

  // Флаг готовности: true когда данные из БД уже записаны в localStorage.
  // До этого момента автозапуск туров заблокирован (защита от race condition).
  const syncedRef = useRef(false)

  // Холодный старт: один запрос к БД при монтировании.
  // Полученные slug-и записываем в localStorage — дальше всё работает локально.
  useEffect(() => {
    let cancelled = false

    async function syncFromDb() {
      try {
        const seenSlugs = await getOnboardingSeenSlugs(userId)
        if (cancelled) return
        seenSlugs.forEach((slug) => markTourSeen(userId, slug))
      } catch {
        // Ошибка сети — работаем с тем что есть в localStorage
      } finally {
        if (!cancelled) syncedRef.current = true
      }
    }

    syncFromDb()
    return () => { cancelled = true }
  }, [userId])

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

    // Ждём синхронизации с БД перед первой проверкой
    // Если синхронизация уже завершена — проверяем сразу
    function tryStart() {
      if (isTourSeen(userId, slug!)) return

      const tour = TOURS.find((t) => t.pageSlug === slug)
      if (!tour) return

      const timer = setTimeout(() => {
        if (isTourSeen(userId, slug!)) return

        markTourSeen(userId, slug!)
        markTourSeenInDb(userId, slug!)
        setActiveTour(tour)
        setCurrentStepIndex(0)
      }, START_DELAY)

      return timer
    }

    // Если синхронизация уже готова — запускаем немедленно
    if (syncedRef.current) {
      const timer = tryStart()
      return () => { if (timer) clearTimeout(timer) }
    }

    // Иначе ждём завершения синхронизации (polling каждые 50мс, max 3с)
    let elapsed = 0
    const poll = setInterval(() => {
      elapsed += 50
      if (!syncedRef.current && elapsed < 3000) return
      clearInterval(poll)
      tryStart()
    }, 50)

    return () => clearInterval(poll)
  }, [pathname, userId])

  const handleNext = useCallback(() => {
    if (!activeTour) return

    const nextIndex = currentStepIndex + 1
    if (nextIndex >= activeTour.steps.length) {
      setActiveTour(null)
      setCurrentStepIndex(0)
    } else {
      setCurrentStepIndex(nextIndex)
    }
  }, [activeTour, currentStepIndex])

  const handleSkip = useCallback(() => {
    if (!activeTour) return
    setActiveTour(null)
    setCurrentStepIndex(0)
  }, [activeTour])

  const startTour = useCallback((pageSlug: string) => {
    const tour = TOURS.find((t) => t.pageSlug === pageSlug)
    if (!tour) return
    markTourSeen(userId, pageSlug)
    markTourSeenInDb(userId, pageSlug)
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
      {process.env.NODE_ENV === 'development' && (
        <OnboardingDevPanel userId={userId} />
      )}
    </OnboardingContext.Provider>
  )
}
