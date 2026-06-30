import type { OnboardingTour } from '../types'

export const adminProductsTour: OnboardingTour = {
  pageSlug: 'admin-products',
  steps: [
    {
      id: 'admin-products-rate',
      target: 'admin-rate-current',
      extraTargets: ['admin-rate-new'],
      title: 'Курс кристаллов',
      description:
        'Цена товаров считается из себестоимости в BYN по курсу кристаллов. Здесь виден текущий курс и история его изменений. Введите новый курс, нажмите «Предпросмотр» — цены в таблице пересчитаются, но пользователей это пока не затронет. «Применить» фиксирует новый курс для всех.',
      placement: 'bottom',
    },
    {
      id: 'admin-products-categories',
      target: 'admin-products-categories',
      title: 'Категории товаров',
      description:
        'Товары разделены по категориям. Для физических исчисляемых категорий отслеживается остаток. Цифровые и неисчисляемые товары не имеют ограничений по количеству. Названия, slug, тип и статус категорий редактируются прямо здесь.',
      placement: 'bottom',
      onBeforeShow: () => {
        // Развернуть аккордеон категорий, если он свёрнут
        const section = document.querySelector('[data-onboarding="admin-products-categories"]')
        if (section && !section.querySelector('table')) {
          section
            .querySelector<HTMLElement>('[data-onboarding-trigger="admin-categories-toggle"]')
            ?.click()
        }
      },
    },
    {
      id: 'admin-products-filter',
      target: 'admin-products-filter',
      title: 'Фильтр товаров',
      description:
        'Инлайн-фильтр по любым полям: статус, категория, цена, остаток, скидка и другим. Вводите условия вида «статус:активен» или «цена:>100» — список товаров фильтруется на лету. Подсказки появляются прямо при вводе.',
      placement: 'bottom',
    },
    {
      id: 'admin-products-table',
      target: 'admin-products-table',
      title: 'Товары и редактирование',
      description:
        'Все товары — в таблице или карточках (переключатель справа сверху). Наведите на категорию, цену, скидку или остаток — появится иконка карандаша для редактирования прямо в строке: Enter — сохранить, Escape — отменить. Иконка карандаша справа открывает полную карточку товара, корзина — удаляет.',
      placement: 'top',
    },
  ],
}
