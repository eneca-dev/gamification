import type { OnboardingTour } from '../types'

export const masterPlannerTour: OnboardingTour = {
  pageSlug: 'master-planner',
  steps: [
    {
      id: 'mp-welcome',
      target: 'mp-header',
      title: 'Мастер планирования',
      description:
        'Здесь собрана полная история ваших задач с бюджетом из Worksection. За каждые 10 задач, закрытых в рамках бюджета, начисляется бонус. Серии L3 (3 уровень задач) и L2 (2 уровень задач) считаются независимо — текущий прогресс виден в шапке.',
      placement: 'bottom',
    },
    {
      id: 'mp-filters',
      target: 'mp-filters',
      title: 'Фильтры',
      description:
        'Фильтруйте события по уровню (L3, L2) и статусу (Закрыта в бюджете, Превышение, Ожидают 30 дней, Отозвано). Так удобно отслеживать конкретные задачи.',
      placement: 'bottom',
    },
  ],
}
