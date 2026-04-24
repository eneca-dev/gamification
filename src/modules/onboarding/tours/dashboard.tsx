import type { OnboardingTour } from '../types'

export const dashboardTour: OnboardingTour = {
  pageSlug: 'dashboard',
  steps: [
    {
      id: 'dashboard-welcome',
      target: null,
      title: 'Добро пожаловать в Геймификацию!',
      description:
        'Вы зарабатываете 💎 за корректное ведение WorkSection, использование Revit-плагинов и помощь коллегам. 💎 можно потратить в магазине на реальные награды. Сейчас пройдёмся по ключевым блокам — это займёт пару минут.',
      placement: 'center',
    },
    {
      id: 'dashboard-balance',
      target: 'sidebar-balance',
      title: 'Ваш баланс',
      description:
        'Текущее количество 💎. 💎 начисляются или отнимаются автоматически каждый день. Потратить их можно в разделе «Магазин».',
      placement: 'right',
    },
    {
      id: 'dashboard-calendar',
      target: 'streak-calendar',
      title: 'Календарь активности',
      description: (
        <span className="flex flex-col gap-2">
          <span className="flex flex-col gap-1">
            <span className="font-semibold" style={{ color: 'var(--apex-primary)' }}>🟢 Зелёный день — все условия WS выполнены:</span>
            <span className="flex flex-col gap-0.5 pl-2" style={{ color: 'var(--text-secondary)' }}>
              <span>✓ Внесён дневной отчёт</span>
              <span>✓ % готовности обновлён до пересечения 20/40/60/80/100% бюджета</span>
              <span>✓ Время в задачах со статусом «В работе»</span>
            </span>
          </span>
          <span style={{ color: 'var(--apex-danger)' }}>🔴 Красный день — нарушено любое условие</span>
          <span className="flex flex-col gap-0.5" style={{ color: 'var(--text-secondary)' }}>
            <span>🔵 Отпуск / больничный — стрик не прерывается</span>
            <span>⭐ Звезда — использование Revit-плагинов</span>
          </span>
          <span style={{ color: 'var(--text-secondary)' }}>
            Worksection и Revit — две независимые механики: один день может быть одновременно и зелёным, и со звездой.
          </span>
          <span className="text-[10px] pt-0.5" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--apex-border)' }}>
            Эти критерии всегда доступны — наведите на ⓘ рядом с заголовком «Worksection» или «Автоматизации».
          </span>
        </span>
      ),
      placement: 'bottom',
    },
    {
      id: 'dashboard-streak',
      target: 'streak-milestones',
      title: 'Серия и защита стрика',
      description: (
        <span className="flex flex-col gap-2.5">
          <span>Два независимых стрика — чем длиннее серия, тем больше бонус на каждом рубеже (суммы видны рядом с прогресс-барами).</span>

          <span className="flex flex-col gap-0.5">
            <span className="font-semibold" style={{ color: 'var(--apex-primary)' }}>🟢 Worksection — зелёные дни</span>
            <span className="pl-2" style={{ color: 'var(--text-secondary)' }}>Каждый день, когда выполнены все WS-условия, продлевает стрик.</span>
          </span>

          <span className="flex flex-col gap-0.5">
            <span className="font-semibold" style={{ color: 'var(--orange-500)' }}>⭐ Автоматизации — запуски Revit-плагинов</span>
            <span className="pl-2" style={{ color: 'var(--text-secondary)' }}>Каждый день, когда вы запустили хотя бы один из плагинов, продлевает стрик:</span>
            <span className="pl-2 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
              Auditor, ClashesManager, LinksManager, ShareModel, SDT, ParamOperator, ApartmentLayouts, FasciaCappings, SpacesManager, ResaveModels, AutoOpenings, Finishing, SharedCoordinates, ProfiLay, LookupTables, ViewCloner, LintelsTransfer, SurfaceGen, QuickMount, SchedulesTable.
            </span>
            <span className="pl-2 text-[11px] font-semibold" style={{ color: 'var(--apex-warning-text)' }}>
              ⚠️ Старые версии плагинов могут не передавать данные — обновите плагины перед использованием.
            </span>
          </span>

          <span
            className="flex flex-col gap-0.5 px-2.5 py-1.5 rounded-lg"
            style={{
              background: 'var(--apex-warning-bg)',
              border: '1px solid rgba(var(--apex-warning-rgb), 0.3)',
            }}
          >
            <span className="font-semibold" style={{ color: 'var(--apex-warning-text)' }}>🛡️ Вторая жизнь — защита стрика</span>
            <span style={{ color: 'var(--apex-warning-dark)' }}>Случился красный день? У вас есть 24 часа, чтобы купить «Вторую жизнь» в магазине и сохранить серию.</span>
          </span>

          <span className="text-[10px] pt-0.5" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--apex-border)' }}>
            Полный список плагинов — ⓘ рядом с «Автоматизации ★». Критерии WS-дня — ⓘ рядом с «Worksection».
          </span>
        </span>
      ),
      placement: 'right',
    },
    {
      id: 'dashboard-master-planner',
      target: 'master-planner-panel',
      title: 'Мастер планирования',
      description: (
        <span className="flex flex-col gap-2.5">
          <span className="flex flex-col gap-0.5">
            <span className="font-semibold" style={{ color: 'var(--apex-primary)' }}>Что такое стрик по бюджету</span>
            <span className="pl-2" style={{ color: 'var(--text-secondary)' }}>Задача засчитывается в серию, если она была закрыта без превышения бюджета. Каждые 10 таких задач подряд — бонус 💎. Серия циклическая: после каждого рубежа счёт начинается заново.</span>
          </span>

          <span className="flex flex-col gap-0.5">
            <span className="font-semibold" style={{ color: 'var(--apex-primary)' }}>L3 (3 уровень задач) и L2 (2 уровень задач) — две независимые серии</span>
          </span>

          <span
            className="flex flex-col gap-0.5 px-2.5 py-1.5 rounded-lg"
            style={{
              background: 'var(--apex-warning-bg)',
              border: '1px solid rgba(var(--apex-warning-rgb), 0.3)',
            }}
          >
            <span className="font-semibold" style={{ color: 'var(--apex-warning-text)' }}>⏳ Начисление через 30 дней</span>
            <span style={{ color: 'var(--apex-warning-dark)' }}>После закрытия задачи бонус не начисляется сразу — задача ждёт 30 дней в разделе «Ожидают 30 дней». Если за это время бюджет не будет превышен, 💎 начислятся автоматически.</span>
          </span>

          <span style={{ color: 'var(--text-secondary)' }}>Превышение бюджета обнуляет серию до 0. Здесь же видны последние события по задачам.</span>
        </span>
      ),
      placement: 'left',
    },
    {
      id: 'dashboard-gratitude',
      target: 'gratitude-widget',
      title: 'Благодарности коллегам',
      description:
        'Нажмите «Поблагодарить», чтобы отправить благодарность. Три варианта: бесплатное «спасибо», подарок из квоты — не тратит ваш баланс (раз в 2 недели), или подарок за свой счёт.',
      placement: 'left',
    },
    {
      id: 'dashboard-transactions',
      target: 'transaction-feed',
      title: 'История операций',
      description:
        'Здесь отображаются последние 5 операций: начисления за зелёные дни, стрик-бонусы, благодарности и покупки. Нажмите «Все операции» для полной истории.',
      placement: 'top',
    },
    {
      id: 'dashboard-leaderboard',
      target: 'leaderboard',
      title: 'Рейтинг сотрудников',
      description:
        'В этих блоках показаны 5 лучших по Worksection и по Revit, но ваш ранг считается среди всех. Сотрудники в отпуске или на больничном не учитываются. Наведите на ℹ️ для подробностей.',
      placement: 'top',
    },
    {
      id: 'dashboard-contest',
      target: 'department-contest',
      title: 'Соревнование отделов',
      description:
        'Ваш отдел соревнуется с другими по корректному ведению Worksection и использованию автоматизаций. Учитывается доля вовлеченных сотрудников — чем больше людей из отдела активны, тем выше позиция в рейтинге. Итоги в конце месяца. Наведите на ℹ️, чтобы узнать формулу расчёта. Ниже — такое же соревнование для команд с аналогичным принципом работы.',
      placement: 'top',
    },
    {
      id: 'dashboard-coins-reference',
      target: 'help-article',
      title: 'Справочник начислений',
      description:
        'Вы в разделе «Справка». Здесь — полный список действий, за которые начисляются 💎 и их суммы. Возвращайтесь сюда, чтобы свериться с правилами.',
      placement: 'left',
      // Открываем страницу справочника до показа подсказки
      onBeforeShow: ({ router }) => {
        router.push('/help/coins-reference')
      },
    },
    {
      id: 'dashboard-finish',
      target: null,
      title: 'Вы готовы!',
      description:
        'Зарабатывайте 💎, поддерживайте стрики, помогайте коллегам и обменивайте 💎 на награды в магазине. Загляните в «Достижения» и «Магазин» в боковом меню — там тоже будут подсказки при первом посещении.',
      placement: 'center',
    },
  ],
}
