import type { OnboardingTour } from '../types'

export const storeTour: OnboardingTour = {
  pageSlug: 'store',
  steps: [
    {
      id: 'store-catalog',
      target: 'store-category-filters',
      title: 'Магазин наград',
      description:
        'Тратьте заработанные коины на реальные награды! Товары разделены по категориям — выбирайте нужную. Некоторые товары имеют ограниченное количество — следите за наличием.',
      placement: 'bottom',
    },
    {
      id: 'store-product',
      target: 'product-card-first',
      title: 'Карточка товара',
      description:
        'Цена указана в коинах. Если баланса хватает — нажмите «Получить». Если нет — кнопка покажет, сколько ещё нужно накопить. Товары с пометкой «Осталось: N» скоро закончатся!',
      placement: 'right',
    },
    {
      id: 'store-lottery',
      target: 'lottery-banner',
      title: 'Ежемесячная лотерея',
      description:
        'Каждый месяц — розыгрыш приза! Купите билет за коины — цена указана на баннере. Чем больше билетов вы купите — тем выше шанс. Розыгрыш проходит 1 числа каждого месяца в 12:00. Ваш шанс рассчитывается автоматически после покупки билета.',
      placement: 'bottom',
    },
  ],
}
