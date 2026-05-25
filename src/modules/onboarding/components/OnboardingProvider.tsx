'use client'

import { Suspense, createContext, useCallback, useContext, useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

import { OnboardingSpotlight } from './OnboardingSpotlight'
import { OnboardingDevPanel } from './OnboardingDevPanel'
import { isTourSeen, markTourSeen, resetTour, resetAllTours } from '../storage'
import { getOnboardingSeenSlugs, markTourSeenInDb } from '../actions'
import { getPageSlug } from '../page-slug'
import { dashboardTour } from '../tours/dashboard'
import { achievementsTour } from '../tours/achievements'
import { storeTour } from '../tours/store'
import { activityTour } from '../tours/activity'
import { activityDeptTour } from '../tours/activity-dept'
import { activityTeamTour } from '../tours/activity-team'
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
  dashboardTour, achievementsTour, storeTour,
  activityTour, activityDeptTour, activityTeamTour,
  adminTour, adminUsersTour, adminProductsTour, adminOrdersTour,
  adminEventsTour, adminCalendarTour, adminAchievementsTour, adminLotteryTour,
  adminHelpTour, helpTour, masterPlannerTour,
]

interface OnboardingContextValue {
  startTour: (pageSlug: string) => void
}

const OnboardingContext = createContext<OnboardingContextValue>({ startTour: () => {} })

export function useOnboardingContext() {
  return useContext(OnboardingContext)
}

const START_DELAY = 1500

// ── Внутренний компонент: читает searchParams и запускает тур ─────────────────

interface AutoStartWatcherProps {
  userId: string
  isSynced: boolean
  onStart: (tour: OnboardingTour) => void
}

function AutoStartWatcher({ userId, isSynced, onStart }: AutoStartWatcherProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    const search = searchParams.toString() ? `?${searchParams.toString()}` : ''
    const slug = getPageSlug(pathname, search)
    if (!slug) return

    function tryStart() {
      if (isTourSeen(userId, slug!)) return
      const tour = TOURS.find((t) => t.pageSlug === slug)
      if (!tour) return

      const timer = setTimeout(() => {
        if (isTourSeen(userId, slug!)) return
        markTourSeen(userId, slug!)
        markTourSeenInDb(userId, slug!)
        onStart(tour)
      }, START_DELAY)

      return timer
    }

    if (!isSynced) return

    const timer = tryStart()
    return () => { if (timer) clearTimeout(timer) }
  }, [pathname, searchParams, userId, isSynced, onStart])

  return null
}

// ── Основной провайдер ────────────────────────────────────────────────────────

interface OnboardingProviderProps {
  userId: string
  children: React.ReactNode
}

export function OnboardingProvider({ userId, children }: OnboardingProviderProps) {
  const pathname = usePathname()
  const [activeTour, setActiveTour] = useState<OnboardingTour | null>(null)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [isSynced, setIsSynced] = useState(false)

  // Холодный старт: один запрос к БД — заполняем localStorage.
  useEffect(() => {
    let cancelled = false
    async function syncFromDb() {
      try {
        const seenSlugs = await getOnboardingSeenSlugs(userId)
        if (cancelled) return
        seenSlugs.forEach((slug) => markTourSeen(userId, slug))
      } catch {
        // Ошибка сети — работаем с localStorage
      } finally {
        if (!cancelled) setIsSynced(true)
      }
    }
    syncFromDb()
    return () => { cancelled = true }
  }, [userId])

  // Dev mode: URL параметры ?onboarding=reset / reset:slug / start:slug
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return
    const params = new URLSearchParams(window.location.search)
    const param = params.get('onboarding')
    if (!param) return

    params.delete('onboarding')
    const newUrl = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname
    window.history.replaceState({}, '', newUrl)

    if (param === 'reset') {
      resetAllTours(userId)
    } else if (param.startsWith('reset:')) {
      resetTour(userId, param.slice(6))
    } else if (param.startsWith('start:')) {
      const tour = TOURS.find((t) => t.pageSlug === param.slice(6))
      if (tour) { setActiveTour(tour); setCurrentStepIndex(0) }
    }
  }, [pathname, userId])

  const handleAutoStart = useCallback((tour: OnboardingTour) => {
    setActiveTour(tour)
    setCurrentStepIndex(0)
  }, [])

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
    setActiveTour(null)
    setCurrentStepIndex(0)
  }, [])

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
      <Suspense fallback={null}>
        <AutoStartWatcher userId={userId} isSynced={isSynced} onStart={handleAutoStart} />
      </Suspense>
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
