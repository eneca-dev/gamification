import type { OnboardingTour } from '../types'

export const activityGratitudesTour: OnboardingTour = {
  pageSlug: 'activity-gratitudes',
  steps: [
    {
      id: 'activity-gratitudes-welcome',
      target: null,
      title: 'Лента благодарностей',
      description:
        'Здесь собраны все благодарности по компании — то, чем коллеги делятся друг с другом. Видно, кто кого поблагодарил, за что и когда. Благодарность бывает двух видов: «спасибо» и «подарок» кристаллов 💎 — подарок приносит получателю начисление на баланс отпправленной суммы.',
      placement: 'center',
    },
    {
      id: 'activity-gratitudes-header-step',
      target: 'activity-gratitudes-header',
      title: 'Все благодарности',
      description:
        'Заголовок страницы. Это полный список благодарностей за всё время, без ограничения по отделу или команде.',
      placement: 'bottom',
    },
    {
      id: 'activity-gratitudes-filters-step',
      target: 'activity-gratitudes-filters',
      title: 'Фильтры и поиск',
      description:
        'Отфильтруйте ленту по категории благодарности или найдите конкретного человека по имени отправителя или получателя.',
      placement: 'bottom',
    },
    {
      id: 'activity-gratitudes-list-step',
      target: 'activity-gratitudes-list',
      title: 'Список благодарностей',
      description:
        'Все благодарности компании от новых к старым. Нажмите «Показать ещё» внизу, чтобы подгрузить больше записей.',
      placement: 'top',
    },
    {
      id: 'activity-gratitudes-item-step',
      target: 'activity-gratitudes-item',
      title: 'Карточка благодарности',
      description:
        'В карточке видно, кто кого поблагодарил, категорию и текст сообщения. Метка «спасибо» — обычная благодарность, «подарок» — благодарность с кристаллами 💎 для получателя.',
      placement: 'right',
    },
    {
      id: 'activity-gratitudes-back-step',
      target: 'activity-gratitudes-back',
      title: 'Назад к ленте компании',
      description:
        'Эта ссылка возвращает в общую ленту компании, где вместе с благодарностями отображаются достижения коллег.',
      placement: 'bottom',
    },
  ],
}
