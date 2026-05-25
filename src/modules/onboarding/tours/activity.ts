import type { OnboardingTour } from '../types'

export const activityTour: OnboardingTour = {
  pageSlug: 'activity',
  steps: [
    {
      id: 'activity-welcome',
      target: null,
      title: 'Лента компании',
      description:
        'Здесь три вкладки: Компания, Отдел и Команда. Компания — всё, что происходит в организации. Переключайтесь, чтобы увидеть результаты своего отдела или команды. Здесь видно, кто получил достижения и благодарности. Нажмите «Все достижения» или «Все благодарности», чтобы увидеть полный список. Вдохновляйтесь успехами коллег!',
      placement: 'center',
    },
  ],
}
