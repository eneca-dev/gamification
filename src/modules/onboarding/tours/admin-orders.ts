import type { OnboardingTour } from '../types'

export const adminOrdersTour: OnboardingTour = {
  pageSlug: 'admin-orders',
  steps: [
    {
      id: 'admin-orders-filters',
      target: 'orders-filter-tabs',
      title: 'Управление заказами',
      description:
        'Фильтры быстро покажут заказы по статусу. По умолчанию в таблице видны только физические товары — тумблер «Виртуальные» справа добавляет цифровые заказы, которые выполняются автоматически.',
      placement: 'bottom',
    },
    {
      id: 'admin-orders-table',
      target: 'admin-orders-table',
      title: 'Таблица заказов',
      description:
        'Для физических товаров статус меняется через выпадающее меню в столбце «Статус». Нажмите «Отменить» — кристаллы 💎 автоматически вернутся покупателю.',
      placement: 'top',
    },
  ],
}
