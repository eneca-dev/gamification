import type { OnboardingTour } from '../types'

export const activityTeamTour: OnboardingTour = {
  pageSlug: 'activity-team',
  steps: [
    {
      id: 'activity-team-table',
      target: 'team-feed-table',
      title: 'Лента команды',
      description:
        'Те же показатели, только отфильтрованные по вашей команде. Строка с названием команды — суммарные результаты. Ниже — каждый сотрудник с его кристаллами, достижениями и благодарностями за текущий месяц.',
      placement: 'top',
    },
  ],
}
