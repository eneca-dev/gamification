import type { OnboardingTour } from '../types'

export const adminEconomyTour: OnboardingTour = {
  pageSlug: 'admin-economy',
  steps: [
    {
      id: 'admin-economy-welcome',
      target: null,
      title: 'Экономический дашборд',
      description:
        'Полная картина движения кристаллов 💎 в компании: сколько заработано и отозвано, куда уходят кристаллы, кто богат и кто в группе риска. Пройдём по блокам.',
      placement: 'center',
    },
    {
      id: 'admin-economy-filters',
      target: 'admin-economy-filters',
      title: 'Фильтры и период',
      description:
        'Выберите период (7 дней — всё время или произвольный диапазон). «Топы» переключают группировку: сотрудники, команды или отделы.',
      placement: 'bottom',
    },
    {
      id: 'admin-economy-rate',
      target: 'admin-economy-rate',
      title: 'Курс кристаллов',
      description:
        'Текущий курс кристаллов 💎 к BYN и история его изменений. По нему пересчитываются все денежные суммы в сводке и каналах ниже с учетом курса в разный период.',
      placement: 'bottom',
    },
    {
      id: 'admin-economy-summary',
      target: 'admin-economy-summary',
      title: 'Сводка',
      description:
        'Ключевые показатели эмиссии за период: заработано, фактически заработано, отозвано и подарено компанией. Внизу — доля отзывов, на которые не хватило баланса.',
      placement: 'top',
    },
    {
      id: 'admin-economy-spending',
      target: 'admin-economy-spending',
      title: 'Куда уходят деньги',
      description:
        'Разбивка трат кристаллов 💎 по каналам: магазин, вторая жизнь, платные благодарности. Видно сумму и число участников в каждом канале.',
      placement: 'top',
    },
    {
      id: 'admin-economy-low-balance',
      target: 'admin-economy-low-balance',
      title: 'Группа риска',
      description:
        'Нижние 10% сотрудников по балансу кристаллов 💎. Фильтр делит выборку на проектировщиков и непроектировщиков. Ниже отдельным блоком — самые богатые (топ 10%).',
      placement: 'top',
    },
    {
      id: 'admin-economy-dept-groups',
      target: 'admin-economy-dept-groups',
      title: 'Группировка отделов',
      description:
        'Распределите отделы между «Проектировщиками» и «Непроектировщиками» — перетащите карточку отдела или нажмите кнопку перемещения. Эта группировка управляет фильтром «проектировщики / непроектировщики» в блоках «Группа риска» и «Самые богатые».',
      placement: 'top',
      onBeforeShow: () => {
        // Развернуть аккордеон группировки, если он свёрнут
        const section = document.querySelector('[data-onboarding="admin-economy-dept-groups"]')
        if (section && !section.querySelector('[data-onboarding-open]')) {
          section
            .querySelector<HTMLElement>('[data-onboarding-trigger="admin-economy-dept-groups-toggle"]')
            ?.click()
        }
      },
    },
    {
      id: 'admin-economy-tops',
      target: 'admin-economy-tops',
      title: 'Топы',
      description:
        'Лидеры по направлениям: заработавшие, тратящие в магазине, покупатели второй жизни, отправители благодарностей и получившие отзывы. Уровень группировки берётся из фильтров вверху.',
      placement: 'top',
    },
  ],
}
