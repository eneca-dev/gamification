import type { OnboardingTour } from '../types'

export const storeTour: OnboardingTour = {
  pageSlug: 'store',
  steps: [
    {
      id: 'store-catalog',
      target: 'store-category-filters',
      title: 'Магазин наград',
      description:
        'Тратьте заработанные кристаллы 💎 на реальные товары! Товары разделены по категориям — выбирайте нужную. Некоторые товары имеют ограниченное количество — следите за наличием.',
      placement: 'bottom',
    },
    {
      id: 'store-product',
      target: 'product-card-first',
      title: 'Карточка товара',
      description:
        'Цена указана в кристаллах 💎. Если баланса хватает — нажмите кнопку со стоимостью для совершения покупки. Если нет — будет показано, сколько ещё нужно накопить. Товары с пометкой «Осталось: N» скоро закончатся!',
      placement: 'right',
    },
    {
      id: 'store-my-orders',
      target: 'store-my-orders',
      title: 'Мои заказы',
      description:
        'После покупки товара заказ появится здесь — нажмите «Мои заказы», чтобы посмотреть историю заказов и их статус.',
      placement: 'bottom',
    },
    // [LOTTERY HIDDEN]
    // {
    //   id: 'store-lottery',
    //   target: 'lottery-banner',
    //   title: 'eneca-game',
    //   description:
    //     'Каждый месяц — eneca-game! Войдите в игру за кристаллы 💎 — цена указана на баннере. Чем больше раз войдёте — тем выше шанс. Игра проходит 1 числа каждого месяца в 12:00. Ваш шанс рассчитывается автоматически.',
    //   placement: 'bottom',
    //   onBeforeShow: () => {
    //     document
    //       .querySelector<HTMLButtonElement>('[data-onboarding-category="draw"]')
    //       ?.click()
    //   },
    // },
  ],
}