import type { ReactNode } from 'react'

export type StepPlacement = 'top' | 'bottom' | 'left' | 'right' | 'center'

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
  /** Выполнить перед поиском target (например, переключить таб, открыть аккордеон) */
  onBeforeShow?: () => void | Promise<void>
}

export interface OnboardingTour {
  /** Slug страницы: 'dashboard', 'achievements', 'store', 'activity' */
  pageSlug: string
  /** Шаги тура по порядку */
  steps: OnboardingStep[]
}
