import type { OnboardingTour } from '../types'

export const adminCalendarTour: OnboardingTour = {
  pageSlug: 'admin-calendar',
  steps: [
    {
      id: 'admin-calendar-months',
      target: 'calendar-first-month',
      title: 'Производственный календарь',
      description:
        'Кликните на рабочий день, чтобы сделать его выходным - он станет красным. Кликните на выходной, чтобы сделать его рабочим - он станет зеленым. Повторный клик отменяет изменение. Календарь влияет на расчёт стриков и рейтингов, поэтому его важно вовремя обновлять.',
      placement: 'top',
    },
  ],
}
