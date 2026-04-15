import type { OnboardingTour } from '../types'

export const adminLotteryTour: OnboardingTour = {
  pageSlug: 'admin-lottery',
  steps: [
    {
      id: 'admin-lottery-current',
      target: 'lottery-current-section',
      title: 'Управление лотереей',
      description:
        'Создайте розыгрыш на текущий месяц — только одна лотерея в месяц. Укажите название, цену билета в коинах и загрузите изображение приза. Розыгрыш проводится автоматически 1 числа следующего месяца в 12:00.',
      placement: 'bottom',
    },
  ],
}
