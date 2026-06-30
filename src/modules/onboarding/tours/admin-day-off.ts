import type { OnboardingTour } from '../types'

export const adminDayOffTour: OnboardingTour = {
  pageSlug: 'admin-day-off',
  steps: [
    {
      id: 'admin-day-off-welcome',
      target: null,
      title: 'Модерация заявок на выходной',
      description:
        'Здесь вы рассматриваете заявки сотрудников на геймификационные выходные. Заявки на рассмотрении ждут вашего решения — одобрения или отклонения. Завершённые заявки скрыты в отдельном разделе.',
      placement: 'center',
    },
    {
      id: 'admin-day-off-list',
      target: 'admin-day-off-list',
      title: 'Заявки на рассмотрении',
      description:
        'Раздел «На рассмотрении» содержит активные заявки, требующие решения. По каждой заявке видно сотрудника, дату выходного, тип и комментарий.',
      placement: 'top',
    },
    {
      id: 'admin-day-off-row',
      target: 'admin-day-off-row',
      title: 'Карточка заявки',
      description:
        'Одна карточка — одна заявка. Слева данные сотрудника и кнопки действий, справа статус и скриншот согласования (если приложен).',
      placement: 'right',
    },
    {
      id: 'admin-day-off-actions',
      target: 'admin-day-off-actions',
      title: 'Одобрение и отклонение',
      description:
        '«Одобрить» подтверждает выходной. «Отклонить» открывает поле для причины — нажмите ещё раз, чтобы подтвердить отказ. Решение по заявке меняет её статус сразу.',
      placement: 'top',
    },
    {
      id: 'admin-day-off-screenshot',
      target: 'admin-day-off-screenshot',
      title: 'Скриншот согласования',
      description:
        'Сотрудник прикладывает скриншот согласования выходного. Нажмите на превью, чтобы открыть изображение в полном размере перед принятием решения.',
      placement: 'left',
    },
  ],
}
