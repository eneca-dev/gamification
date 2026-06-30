import type { OnboardingTour } from '../types'

export const adminFeedbackTour: OnboardingTour = {
  pageSlug: 'admin-feedback',
  steps: [
    {
      id: 'admin-feedback-welcome',
      target: null,
      title: 'Обратная связь',
      description:
        'Вся обратная связь от сотрудников — баги и предложения — уходит напрямую команде разработки. Этот раздел носит справочный характер: здесь можно просмотреть обращения, но обрабатывает их команда разработки.',
      placement: 'center',
    },
  ],
}
