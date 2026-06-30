import type { OnboardingTour } from '../types'

export const transactionsTour: OnboardingTour = {
  pageSlug: 'transactions',
  steps: [
    {
      id: 'transactions-intro',
      target: null,
      title: 'История операций',
      description:
        'Здесь собраны все начисления и списания ваших кристаллов 💎. Каждая строка — отдельная операция: достижение, благодарность, покупка в магазине или закрытая задача. Давайте разберём, как пользоваться этим разделом.',
      placement: 'center',
    },
    {
      id: 'transactions-total',
      target: 'transactions-total',
      title: 'Итог по фильтру',
      description:
        'Эта плашка показывает суммарный баланс кристаллов 💎 по выбранным фильтрам. Зелёный — вы заработали больше, чем потратили, красный — наоборот. Значение пересчитывается при смене фильтров.',
      placement: 'left',
    },
    {
      id: 'transactions-filters',
      target: 'transactions-filters',
      title: 'Фильтры',
      description:
        'Отбирайте операции по типу — Worksection, Revit, благодарности, достижения или магазин — и по диапазону дат. Фильтры сохраняются в ссылке, поэтому работает кнопка «назад» и можно поделиться выборкой.',
      placement: 'bottom',
    },
    {
      id: 'transactions-list',
      target: 'transactions-list',
      title: 'Список операций',
      description:
        'Все операции по порядку. Нажмите на заголовок «Дата», чтобы переключить сортировку — от новых к старым или наоборот. Если строк больше 30 — внизу появится постраничная навигация.',
      placement: 'top',
    },
    {
      id: 'transactions-row-first',
      target: 'transactions-row-first',
      title: 'Одна операция',
      description:
        'Слева — иконка и описание, справа — тип и сумма кристаллов 💎. Зелёная сумма с «+» — начисление, красная — списание. У операций с несколькими задачами есть стрелка для раскрытия деталей, а ссылки ведут прямо к задаче.',
      placement: 'bottom',
    },
  ],
}
