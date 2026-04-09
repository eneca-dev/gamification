import type { OnboardingTour } from '../types'

export const adminOrdersTour: OnboardingTour = {
  pageSlug: 'admin-orders',
  steps: [
    {
      id: 'admin-orders-filters',
      target: 'orders-filter-tabs',
      title: 'Управление заказами',
      description:
        'Фильтры быстро покажут заказы по статусу. Цифровые заказы выполняются автоматически. При отмене коины возвращаются покупателю — отмена необратима.',
      placement: 'bottom',
    },
    {
      id: 'admin-orders-table',
      target: 'admin-orders-table',
      title: 'Таблица заказов',
      description:
        'Для физических товаров статус меняется через выпадающее меню в столбце «Статус». Нажмите «Отменить» — коины автоматически вернутся покупателю.',
      placement: 'top',
    },
  ],
}
