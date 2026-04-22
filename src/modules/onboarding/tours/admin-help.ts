import type { OnboardingTour } from '../types'

export const adminHelpTour: OnboardingTour = {
  pageSlug: 'admin-help',
  steps: [
    {
      id: 'admin-help-articles',
      target: 'admin-help-articles',
      title: 'Редактирование справки',
      description:
        'Здесь редактируются статьи справки. Опубликованные статьи видны всем пользователям в разделе «Справка». Кнопка «Изменить» открывает редактор, «Новая статья» создаёт новую.',
      placement: 'top',
    },
  ],
}
