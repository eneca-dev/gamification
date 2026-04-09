export type StepPlacement = 'top' | 'bottom' | 'left' | 'right' | 'center'

export interface OnboardingStep {
  /** Уникальный id шага внутри тура */
  id: string
  /** data-onboarding selector (null = модалка по центру экрана) */
  target: string | null
  /** Заголовок подсказки */
  title: string
  /** Текст подсказки */
  description: string
  /** Предпочтительное положение tooltip относительно target */
  placement: StepPlacement
}

export interface OnboardingTour {
  /** Slug страницы: 'dashboard', 'achievements', 'store', 'activity' */
  pageSlug: string
  /** Шаги тура по порядку */
  steps: OnboardingStep[]
}
