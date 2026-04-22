import type { OnboardingTour } from '../types'

export const adminCalendarTour: OnboardingTour = {
  pageSlug: 'admin-calendar',
  steps: [
    {
      id: 'admin-calendar-months',
      target: 'calendar-first-month',
      title: 'Производственный календарь',
      description:
        'Кликните на рабочий день, чтобы сделать его выходным (красный). Кликните на выходной — чтобы сделать его рабочим (зелёный). Повторный клик отменяет изменение. Календарь влияет на расчёт стриков и рейтингов.',
      placement: 'top',
    },
  ],
}
