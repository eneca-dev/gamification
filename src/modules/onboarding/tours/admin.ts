import type { OnboardingTour } from '../types'

export const adminTour: OnboardingTour = {
  pageSlug: 'admin',
  steps: [
    {
      id: 'admin-nav',
      target: 'admin-nav',
      title: 'Админ-панель',
      description:
        'Вы здесь управляете всей механикой начисления баллов. Разделы: события и награды, товары и заказы, производственный календарь, достижения и лотерея. При первом посещении каждого раздела появятся подсказки.',
      placement: 'bottom',
    },
  ],
}
