import type { OnboardingTour } from '../types'

export const activityDeptTour: OnboardingTour = {
  pageSlug: 'activity-dept',
  steps: [
    {
      id: 'activity-dept-table',
      target: 'dept-feed-table',
      title: 'Лента отдела',
      description:
        'Здесь вы можете увидеть кристаллы, которые каждый заработал за месяц по ведению WS и использованию Revit. В «Достижениях» видны полученные награды и прогресс к следующим. В «Благодарностях» — за какие качества коллеги говорили спасибо. Нажмите на команду, чтобы раскрыть список сотрудников.',
      placement: 'top',
    },
  ],
}
