import type { OnboardingTour } from '../types'

export const activityTour: OnboardingTour = {
  pageSlug: 'activity',
  steps: [
    {
      id: 'activity-welcome',
      target: null,
      title: 'Лента компании',
      description:
        'Здесь видно, кто получил достижения и благодарности за последние 2 недели. Нажмите «Все благодарности», чтобы увидеть полный список. Вдохновляйтесь успехами коллег!',
      placement: 'center',
    },
  ],
}
