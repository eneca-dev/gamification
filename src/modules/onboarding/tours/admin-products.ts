import type { OnboardingTour } from '../types'

export const adminProductsTour: OnboardingTour = {
  pageSlug: 'admin-products',
  steps: [
    {
      id: 'admin-products-categories',
      target: 'admin-products-categories',
      title: 'Категории и товары',
      description:
        'Товары разделены по категориям. Для физических категорий отслеживается остаток на складе. Цифровые товары (щиты, лотерея) не имеют ограничений по количеству.',
      placement: 'bottom',
    },
    {
      id: 'admin-products-table',
      target: 'admin-products-table',
      title: 'Редактирование в таблице',
      description:
        'Наведите на название, цену или остаток — появится иконка карандаша. Кликните для редактирования прямо в таблице. Enter — сохранить, Escape — отменить.',
      placement: 'top',
    },
  ],
}
