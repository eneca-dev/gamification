import type { OnboardingTour } from '../types'

export const activityAchievementsTour: OnboardingTour = {
  pageSlug: 'activity-achievements',
  steps: [
    {
      id: 'activity-achievements-welcome',
      target: null,
      title: 'Лента достижений компании',
      description:
        'Это полная история достижений по всей компании. Здесь видно, кто из коллег заработал достижения — личные, командные и по отделам. В отличие от ленты компании, тут собраны только достижения, без благодарностей. Вдохновляйтесь успехами других и узнавайте, в каких областях люди выходят в топ.',
      placement: 'center',
    },
    {
      id: 'activity-achievements-title',
      target: 'activity-achievements-title',
      title: 'Все достижения',
      description:
        'Раздел показывает достижения за все доступные периоды, сгруппированные по месяцам — от свежих к старым. Прокручивайте вниз, чтобы посмотреть историю прошлых месяцев.',
      placement: 'bottom',
    },
    {
      id: 'activity-achievements-feed',
      target: 'activity-achievements-feed',
      title: 'Фильтры и список',
      description:
        'Сверху — фильтры: по области (Revit, Worksection, Благодарности) и по уровню (Личные, Командные, Отдел). Ниже — карточки достижений. На каждой: эмодзи уровня, кто получил, область и тип достижения.',
      placement: 'top',
    },
    {
      id: 'activity-achievements-back',
      target: 'activity-achievements-back',
      title: 'Назад в ленту компании',
      description:
        'Эта ссылка возвращает в общую ленту компании, где собраны и достижения, и благодарности за последнее время. Используйте её, чтобы вернуться к сводке активности.',
      placement: 'bottom',
    },
  ],
}
