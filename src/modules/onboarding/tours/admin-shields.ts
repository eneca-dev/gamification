import type { OnboardingTour } from '../types'

export const adminShieldsTour: OnboardingTour = {
  pageSlug: 'admin-shields',
  steps: [
    {
      id: 'admin-shields-welcome',
      target: null,
      title: 'Аудит щитов',
      description:
        'Щит («вторая жизнь») защищает выбранную дату от штрафов. Сотрудники покупают щиты за кристаллы 💎 и применяют их к конкретному дню. На этой странице вы видите аудит всех использованных щитов — кто, когда и какую дату защитил.',
      placement: 'center',
    },
  ],
}
