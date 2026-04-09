import type { OnboardingTour } from '../types'

export const adminUsersTour: OnboardingTour = {
  pageSlug: 'admin-users',
  steps: [
    {
      id: 'admin-users-table',
      target: 'admin-users-table',
      title: 'Сотрудники компании',
      description:
        'Сотрудники сгруппированы по отделам и командам. Используйте поиск и фильтры вверху. Нажмите на строку сотрудника, чтобы открыть детальный профиль с историей операций и балансом.',
      placement: 'top',
    },
    {
      id: 'admin-users-toggle',
      target: 'admin-users-toggle',
      title: 'Управление правами',
      description:
        'Переключатель «Админ» даёт сотруднику доступ к этой панели. Будьте аккуратны — админ видит все данные и может изменять настройки системы.',
      placement: 'left',
    },
  ],
}
