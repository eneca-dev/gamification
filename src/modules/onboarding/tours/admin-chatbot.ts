import type { OnboardingTour } from '../types'

export const adminChatbotTour: OnboardingTour = {
  pageSlug: 'admin-chatbot',
  steps: [
    {
      id: 'admin-chatbot-welcome',
      target: null,
      title: 'База знаний чат-бота',
      description:
        'Здесь собраны все инструкции для работы чат-бота. Обычной справки боту не хватило, поэтому это отдельная база знаний именно для него. При необходимости можно что-то менять и добавлять, а затем обязательно нужно обновить чанки — так пройдёт векторизация и чат-бот узнает обо всех изменениях. Без этого он будет отвечать по старым данным.',
      placement: 'center',
    },
  ],
}
