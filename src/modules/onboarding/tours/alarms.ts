import type { OnboardingTour } from '../types'

export const alarmsTour: OnboardingTour = {
  pageSlug: 'alarms',
  steps: [
    {
      id: 'alarms-welcome',
      target: null,
      title: 'Алармы',
      description:
        'Алармы — это напоминания о задачах из Worksection, у которых скоро наступит контрольная точка по бюджету. Если вовремя не сменить метку, задача уйдёт в просрочку. Здесь собраны все актуальные напоминания на сегодня — реагируйте, пока не поздно.',
      placement: 'center',
    },
    {
      id: 'alarms-header',
      target: 'alarms-header',
      title: 'Заголовок и счётчик',
      description:
        'Иконка-колокол отмечает раздел напоминаний. Справа — счётчик: сколько напоминаний вы уже закрыли из общего числа за сегодня.',
      placement: 'bottom',
    },
    {
      id: 'alarms-list',
      target: 'alarms-list',
      title: 'Список напоминаний',
      description:
        'Все актуальные напоминания собраны в один список. Сначала идут активные, отсортированные по важности (critical → warning → info), затем уже закрытые.',
      placement: 'top',
    },
    {
      id: 'alarms-item',
      target: 'alarms-item',
      title: 'Карточка напоминания',
      description:
        'Каждая карточка показывает уровень метки (L2/L3), что нужно сделать, расход бюджета и ближайший чекпоинт. Название задачи — ссылка в Worksection. Кнопкой-галочкой справа отметьте напоминание выполненным; его всегда можно вернуть в активные.',
      placement: 'top',
    },
    {
      id: 'alarms-back-link',
      target: 'alarms-back-link',
      title: 'Возврат на главную',
      description:
        'Закрыли все напоминания — вернитесь на главную по этой ссылке. Краткая сводка по алармам также доступна на дашборде.',
      placement: 'bottom',
    },
  ],
}
