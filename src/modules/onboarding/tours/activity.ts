import type { OnboardingTour } from '../types'

export const activityTour: OnboardingTour = {
  pageSlug: 'activity',
  steps: [
    {
      id: 'activity-welcome',
      target: null,
      title: 'Лента компании',
      description:
        'Здесь видно, что происходит в организации: кто получил достижения и благодарности. Вдохновляйтесь успехами коллег! Давайте разберём, как пользоваться разделом.',
      placement: 'center',
    },
    {
      id: 'activity-tabs',
      target: 'feed-tabs',
      title: 'Вкладки: компания, отдел, команда',
      description:
        'Переключайте ленту между тремя уровнями. Компания — всё, что происходит в организации. Отдел и Команда — результаты вашего отдела или команды за текущий месяц.',
      placement: 'bottom',
    },
    {
      id: 'activity-all-achievements',
      target: 'activity-all-achievements-link',
      title: 'Все достижения',
      description:
        'Нажмите «Все достижения», чтобы открыть полную ленту достижений компании за все периоды с фильтрами по области и уровню.',
      placement: 'left',
    },
    {
      id: 'activity-all-gratitudes',
      target: 'activity-all-gratitudes-link',
      title: 'Все благодарности',
      description:
        'Нажмите «Все благодарности», чтобы увидеть полный список благодарностей компании за всё время с фильтрами и поиском по людям.',
      placement: 'left',
    },
  ],
}
