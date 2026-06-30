import type { OnboardingTour } from '../types'

export const adminFeedbackTour: OnboardingTour = {
  pageSlug: 'admin-feedback',
  steps: [
    {
      id: 'admin-feedback-welcome',
      target: null,
      title: 'Обратная связь',
      description:
        'Здесь администратор просматривает обращения сотрудников — баги и предложения по работе системы. Покажем, как читать обращения и наводить порядок в списке.',
      placement: 'center',
    },
    {
      id: 'admin-feedback-header',
      target: 'admin-feedback-header',
      title: 'Раздел обращений',
      description:
        'Заголовок раздела. Под ним собраны все обращения от пользователей: сообщения об ошибках и идеи по улучшению.',
      placement: 'bottom',
    },
    {
      id: 'admin-feedback-table',
      target: 'admin-feedback-table',
      title: 'Список обращений',
      description:
        'Таблица всех обращений. Для каждого видны тип (баг или предложение), текст обращения, автор с отделом и командой, дата и прикреплённые файлы. Внизу — общее количество.',
      placement: 'top',
    },
    {
      id: 'admin-feedback-header-row',
      target: 'admin-feedback-header-row',
      title: 'Выбор и удаление',
      description:
        'Чекбокс слева выделяет сразу все обращения. После выбора появится панель с количеством и кнопкой удаления — так очищают обработанные обращения.',
      placement: 'bottom',
    },
    {
      id: 'admin-feedback-row',
      target: 'admin-feedback-row',
      title: 'Строка обращения',
      description:
        'Одно обращение. Бейдж показывает тип, имя автора ведёт в его профиль, миниатюры файлов открываются на весь экран по клику. Чекбокс слева отмечает обращение для удаления.',
      placement: 'bottom',
    },
  ],
}
