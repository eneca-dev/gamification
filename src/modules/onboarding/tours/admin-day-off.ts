import type { OnboardingTour } from '../types'

export const adminDayOffTour: OnboardingTour = {
  pageSlug: 'admin-day-off',
  steps: [
    {
      id: 'admin-day-off-welcome',
      target: null,
      title: 'Модерация заявок на выходной',
      description:
        'Здесь вы рассматриваете заявки сотрудников на геймификационные выходные. Заявки одобряются автоматически, но при необходимости вы можете одобрить или отклонить их вручную.',
      placement: 'center',
    },
  ],
}
