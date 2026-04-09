import type { OnboardingTour } from '../types'

export const adminAchievementsTour: OnboardingTour = {
  pageSlug: 'admin-achievements',
  steps: [
    {
      id: 'admin-achievements-progress',
      target: 'achievements-progress-card',
      title: 'Мониторинг достижений',
      description:
        'Здесь общий прогресс по компании за текущий месяц по всем направлениям. Ниже — поиск по конкретному сотруднику для детального просмотра его прогресса.',
      placement: 'bottom',
    },
  ],
}
