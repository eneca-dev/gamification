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
    {
      id: 'admin-shields-header',
      target: 'admin-shields-header',
      title: 'Использования второй жизни',
      description:
        'Заголовок с счётчиком показывает общее количество применённых щитов. Если щитов ещё нет — таблица заменяется сообщением о том, что вторую жизнь пока никто не использовал.',
      placement: 'bottom',
    },
    {
      id: 'admin-shields-table',
      target: 'admin-shields-table',
      title: 'Журнал щитов',
      description:
        'Таблица содержит все использования щитов: сотрудник, тип щита (Дисциплина WS или Автоматизация Revit), защищённая дата и дата покупки. Записи только для просмотра — изменить или удалить их нельзя.',
      placement: 'top',
    },
    {
      id: 'admin-shields-row',
      target: 'admin-shields-row',
      title: 'Запись об использовании',
      description:
        'Одна строка — один применённый щит. Слева указаны имя и e-mail сотрудника, рядом цветной бейдж типа щита. Так вы понимаете, кто именно воспользовался защитой.',
      placement: 'bottom',
    },
    {
      id: 'admin-shields-protected-date',
      target: 'admin-shields-protected-date',
      title: 'Защищённая дата',
      description:
        'Это день, который щит закрыл от штрафов и срабатываний будильника. Дата покупки в соседнем столбце показывает, когда сотрудник применил щит — сравните их при разборе спорных ситуаций.',
      placement: 'left',
    },
  ],
}
