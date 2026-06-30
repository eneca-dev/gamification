import type { OnboardingTour } from '../types'

export const achievementsAllTour: OnboardingTour = {
  pageSlug: 'achievements-all',
  steps: [
    {
      id: 'achievements-all-welcome',
      target: null,
      title: 'Все мои достижения',
      description:
        'Это полная история ваших достижений — весь каталог за всё время, без ограничения текущим кварталом. Достижения зарабатываются в трёх областях: Revit-автоматизация ⚡, Worksection 📋 и благодарности 💜, в личном, командном и форматах отдела. Чтобы получить достижение — продержитесь 10 дней в топе рейтинга за месяц или соберите 4 благодарности в одной категории.',
      placement: 'center',
    },
    {
      id: 'achievements-all-header',
      target: 'achievements-all-header',
      title: 'Полная история',
      description:
        'Здесь собраны все ваши достижения за всё время. По ссылке «Достижения» наверху можно вернуться к обзору с полкой трофеев за текущий квартал.',
      placement: 'bottom',
    },
    {
      id: 'achievements-all-month',
      target: 'achievements-all-month',
      title: 'Группировка по месяцам',
      description:
        'Достижения сгруппированы по календарным месяцам — от свежих к старым. Период каждого достижения — один месяц, в начале нового месяца рейтинги обнуляются и борьба начинается заново.',
      placement: 'bottom',
    },
    {
      id: 'achievements-all-card',
      target: 'achievements-all-card',
      title: 'Карточка достижения',
      description:
        'Каждая карточка — одно полученное достижение. Эмодзи и подпись показывают формат: 🏆 личное, 🛡️ командное, 👑 отдела. Ниже — область, в которой оно заработано (Revit, Worksection или конкретная категория благодарностей).',
      placement: 'right',
    },
    {
      id: 'achievements-all-bonus',
      target: 'achievements-all-bonus',
      title: 'Результат и награда',
      description:
        'Здесь видно, сколько дней вы продержались в топе, и сколько кристаллов 💎 принесло достижение: личное — 200 кристаллов 💎, командное — 150 кристаллов 💎, достижение отдела — 100 кристаллов 💎. Чем выше формат и дольше серия — тем ценнее результат.',
      placement: 'top',
    },
  ],
}
