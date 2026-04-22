import type { OnboardingTour } from '../types'

export const adminEventsTour: OnboardingTour = {
  pageSlug: 'admin-events',
  steps: [
    {
      id: 'admin-events-types',
      target: 'admin-events-types',
      title: 'Типы событий',
      description:
        'Каждое событие имеет системный ключ и настраиваемое количество 💎. Положительные значения — начисление, отрицательные — штраф. Отключённые события не обрабатываются системой. Наведите и нажмите карандаш для редактирования.',
      placement: 'bottom',
    },
    {
      id: 'admin-events-achievements',
      target: 'admin-events-achievements',
      title: 'Пороги достижений',
      description:
        'Настройте, сколько дней в топе нужно для рейтинговых достижений (1–31) и сколько благодарностей — для получения достижения. Здесь же можно поменять бонус 💎 за каждый тип достижения.',
      placement: 'top',
    },
  ],
}
