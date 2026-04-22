import type { ReactNode } from 'react'
import type { useRouter } from 'next/navigation'

export type StepPlacement = 'top' | 'bottom' | 'left' | 'right' | 'center'

/** Контекст, передаваемый в onBeforeShow — даёт доступ к навигации без хуков */
export interface OnboardingStepContext {
  router: ReturnType<typeof useRouter>
}

export interface OnboardingStep {
  /** Уникальный id шага внутри тура */
  id: string
  /** data-onboarding selector (null = модалка по центру экрана) */
  target: string | null
  /** Заголовок подсказки */
  title: string
  /** Текст подсказки (строка или JSX для форматированного контента) */
  description: ReactNode
  /** Предпочтительное положение tooltip относительно target */
  placement: StepPlacement
  /** Выполнить перед поиском target (переключить таб, открыть аккордеон, перейти на страницу) */
  onBeforeShow?: (ctx: OnboardingStepContext) => void | Promise<void>
}

export interface OnboardingTour {
  /** Slug страницы: 'dashboard', 'achievements', 'store', 'activity' */
  pageSlug: string
  /** Шаги тура по порядку */
  steps: OnboardingStep[]
}
