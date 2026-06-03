import type { OnboardingTour } from '../types'

export const adminLotteryTour: OnboardingTour = {
  pageSlug: 'admin-lottery',
  steps: [
    {
      id: 'admin-lottery-current',
      target: 'lottery-current-section',
      title: 'Управление eneca-game',
      description:
        'Запустите eneca-game на текущий месяц — только одна игра в месяц. Укажите название, стоимость игры в 💎 и загрузите изображение приза. Игра проводится автоматически 1 числа следующего месяца в 12:00.',
      placement: 'bottom',
    },
  ],
}