import type { OnboardingTour } from '../types'

export const helpTour: OnboardingTour = {
  pageSlug: 'help',
  steps: [
    {
      id: 'help-welcome',
      target: null,
      title: 'Справка',
      description:
        'Здесь собрана вся документация о системе геймификации: правила начисления баллов, стрики, достижения, магазин и другие механики.',
      placement: 'center',
    },
    {
      id: 'help-search',
      target: 'help-search',
      title: 'Поиск по справке',
      description:
        'Поиск работает по всем статьям — ищет совпадения в заголовках и тексте. Найденные фрагменты выделяются зелёным прямо в тексте статьи.',
      placement: 'bottom',
    },
  ],
}
