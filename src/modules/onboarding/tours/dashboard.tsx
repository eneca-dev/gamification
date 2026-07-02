import { PLUGIN_NAMES } from '@/config/plugins'

import type { OnboardingTour } from '../types'

export const dashboardTour: OnboardingTour = {
  pageSlug: 'dashboard',
  steps: [
    {
      id: 'dashboard-welcome',
      target: null,
      title: 'Добро пожаловать в Геймификацию!',
      description:
        'Вы зарабатываете кристаллы 💎 за корректное ведение WorkSection, использование Revit-плагинов и помощь коллегам. Кристаллы 💎 можно потратить в магазине на реальные награды. Сейчас пройдёмся по ключевым блокам — это займёт пару минут.',
      placement: 'center',
    },
    {
      id: 'dashboard-balance',
      target: 'sidebar-balance',
      title: 'Ваш баланс',
      description:
        'Текущее количество кристаллов 💎. Кристаллы 💎 начисляются или отнимаются автоматически каждый день. Потратить их можно в разделе «Магазин».',
      placement: 'right',
    },
    {
      id: 'dashboard-calendar',
      target: 'streak-calendar',
      title: 'Календарь активности',
      description: (
        <span className="flex flex-col gap-2">
          <span className="font-semibold" style={{ color: 'var(--apex-text)' }}>
            🔥 Стрик — это серия подряд идущих зелёных дней или звёздочек за использование плагинов. Выходные увеличивают стрик независимо от других условий. 
          </span>
          <span className="flex flex-col gap-1" style={{ paddingTop: '2px', borderTop: '1px solid var(--apex-border)' }}>
            <span className="font-semibold" style={{ color: 'var(--apex-primary)' }}>🟢 Зелёный день — все условия WS выполнены:</span>
            <span className="flex flex-col gap-0.5 pl-2" style={{ color: 'var(--text-secondary)' }}>
              <span>✓ Внесён дневной отчёт</span>
              <span>✓ % готовности обновлён на каждом 20%-чекпоинте бюджета (20/40/60/80/100/120/…)</span>
              <span>✓ Время в задачах со статусом «В работе»</span>
              <span className="text-[10px]" style={{ color: 'var(--apex-warning-text)' }}>
                ⚠️ Важно: после перевода задачи в статус «В работе» подождите 90 секунд перед следующей сменой статуса.
              </span>
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
              {PLUGIN_NAMES.join(', ')}.
            </span>
            <span className="pl-2 text-[11px] font-semibold" style={{ color: 'var(--apex-warning-text)' }}>
              ⚠️ Старые версии плагинов могут не передавать данные — обновите плагины перед использованием.
            </span>
            <span className="pl-2 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
              Плагины не засчитываются? В справке «Кристаллы за плагины» есть список, что проверить.
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
            <span className="pl-2" style={{ color: 'var(--text-secondary)' }}>Задача засчитывается в серию, если она была закрыта без превышения бюджета. Каждые 10 таких задач подряд — бонус в кристаллах 💎. Серия циклическая: после каждого рубежа счёт начинается заново.</span>
          </span>

          <span className="flex flex-col gap-0.5">
            <span className="font-semibold" style={{ color: 'var(--apex-primary)' }}>L3 (3 уровень задач) и L2 (2 уровень задач) — две независимые серии</span>
          </span>

          <span className="flex flex-col gap-0.5">
            <span className="font-semibold" style={{ color: 'var(--apex-primary)' }}>Задачи, закрытые в срок</span>
            <span className="pl-2" style={{ color: 'var(--text-secondary)' }}>Задача, закрытая в срок (по дедлайну), приносит несколько кристаллов 💎, но в серию не складывается — серию формируют только задачи, закрытые без превышения бюджета.</span>
          </span>

          <span
            className="flex flex-col gap-0.5 px-2.5 py-1.5 rounded-lg"
            style={{
              background: 'var(--apex-warning-bg)',
              border: '1px solid rgba(var(--apex-warning-rgb), 0.3)',
            }}
          >
            <span className="font-semibold" style={{ color: 'var(--apex-warning-text)' }}>⏳ Начисление через 30 дней</span>
            <span style={{ color: 'var(--apex-warning-dark)' }}>После закрытия задачи бонус не начисляется сразу — задача ждёт 30 дней в разделе «Ожидают 30 дней». Если за это время бюджет не будет превышен, кристаллы 💎 начислятся автоматически.</span>
          </span>

          <span style={{ color: 'var(--text-secondary)' }}>Превышение бюджета обнуляет серию до 0. Здесь же видны последние события по задачам.</span>
        </span>
      ),
      placement: 'left',
    },
    {
      id: 'dashboard-alarms',
      target: 'alarms-widget',
      title: 'Напоминания',
      description: (
        <span className="flex flex-col gap-2.5">
          <span>Здесь появляются задачи Worksection, в которых пора сменить метку прогресса — расход бюджета приближается к контрольной точке.</span>

          <span className="flex flex-col gap-0.5">
            <span className="font-semibold" style={{ color: 'var(--apex-text)' }}>Как считаются чекпоинты</span>
            <span className="pl-2" style={{ color: 'var(--text-secondary)' }}>
              Расход бюджета от планового делится на промежутки: 0–20%, 21–40%, 41–60% и так далее. В каждом промежутке должна быть хотя бы одна смена метки прогресса — важен сам факт смены. Напоминание появляется, когда бюджет вот-вот пройдёт границу промежутка, а метку ещё не меняли.
            </span>
          </span>

          <span className="flex flex-col gap-0.5">
            <span className="font-semibold" style={{ color: 'var(--apex-primary)' }}>Проверяются только метки L3</span>
            <span className="pl-2" style={{ color: 'var(--text-secondary)' }}>
              Но если метку L3 не сменить вовремя, красный день получают двое: ответственный за саму L3 и ответственный за L2, внутри которой лежит эта L3.
            </span>
          </span>

          <span className="flex flex-col gap-0.5">
            <span className="font-semibold" style={{ color: 'var(--orange-500)' }}>Напоминание видят оба</span>
            <span className="pl-2" style={{ color: 'var(--text-secondary)' }}>
              <span className="font-semibold" style={{ color: 'var(--apex-primary)' }}>L3</span> — ответственному за задачу: «Смените метку».
              {' '}
              <span className="font-semibold" style={{ color: 'var(--orange-500)' }}>L2</span> — ответственному за раздел: «Проверьте метку L3» с именем исполнителя.
            </span>
          </span>

          <span className="text-[10px] pt-0.5" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--apex-border)' }}>
            Закрывайте напоминания галочкой по мере смены меток. Полный список — по ссылке «Все напоминания».
          </span>
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
        'Здесь отображаются последние 5 операций: начисления за зелёные дни, полученные бонусы, благодарности, покупки и прочее. Нажмите «Все операции» для полной истории.',
      placement: 'top',
    },
    {
      id: 'dashboard-leaderboard',
      target: 'leaderboard',
      title: 'Рейтинг сотрудников',
      description:
        'В этих блоках показан рейтинг среди сотрудников по Worksection и по Revit. Сотрудники в отпуске или на больничном не учитываются. Наведите на ℹ️ для подробностей.',
      placement: 'top',
    },
    {
      id: 'dashboard-contest',
      target: 'department-contest',
      title: 'Соревнование отделов',
      description:
        'Ваш отдел соревнуется с другими по корректному ведению Worksection и использованию автоматизаций. По WS считается среднее по заработанным кристаллам 💎 на сотрудника, по Revit — (сумма кристаллов 💎 × коэффициент вовлечённости) ÷ кол-во людей, где коэффициент вовлечённости = доля использующих плагины в отчетном периоде. Это уравнивает отделы разного размера. Наведите на ℹ️, чтобы узнать точную формулу. Ниже — аналогичное соревнование для команд.',
      placement: 'top',
    },
    {
      id: 'dashboard-assistant',
      target: 'chat-assistant',
      title: 'AI-ассистент',
      description:
        'Не нашли ответ в справке? Спросите ассистента — он отвечает на вопросы о правилах геймификации: начислениях, стриках, достижениях и магазине. Кнопка доступна на любой странице в правом верхнем углу.',
      placement: 'left',
    },
    {
      id: 'dashboard-feedback',
      target: 'feedback-button',
      title: 'Обратная связь',
      description:
        'Что-то работает не так или есть идея, как улучшить систему? Нажмите «Обратная связь» — опишите баг или предложение и при необходимости приложите файлы. Кнопка доступна на любой странице в правом нижнем углу.',
      placement: 'left',
    },
    {
      id: 'dashboard-day-off',
      target: 'day-off-type-switch',
      extraTargets: ['sidebar-day-off'],
      title: 'Запросить выходной',
      description: (
        <span className="flex flex-col gap-2.5">
          <span>Вы находитесь в разделе «Запросить выходной» — открыть его всегда можно по подсвеченному пункту в боковом меню слева. Здесь оформляется заявка для системы геймификации, чтобы стрик заморозился и вы не получили красный день за отсутствие.</span>

          <span className="flex flex-col gap-0.5">
            <span className="font-semibold" style={{ color: 'var(--apex-primary)' }}>Соцотпуск</span>
            <span className="pl-2" style={{ color: 'var(--text-secondary)' }}>Отпуск за свой счёт. Нужно указать даты и приложить скриншот согласования с руководителем.</span>
          </span>

          <span className="flex flex-col gap-0.5">
            <span className="font-semibold" style={{ color: 'var(--orange-500)' }}>Командировка</span>
            <span className="pl-2" style={{ color: 'var(--text-secondary)' }}>Достаточно указать даты и комментарий — скриншот не требуется.</span>
          </span>

          <span className="text-[10px] pt-0.5" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--apex-border)' }}>
            Эта заявка только для системы геймификации — она не заменяет официальное оформление.
          </span>
        </span>
      ),
      placement: 'left',
      // Перед показом переходим на страницу заявки на выходной
      onBeforeShow: ({ router }) => {
        router.push('/day-off')
      },
    },
    {
      id: 'dashboard-coins-reference',
      target: 'help-article',
      title: 'Справочник начислений',
      description:
        'Вы в разделе «Справка». Здесь — полный список действий, за которые начисляются кристаллы 💎 и их суммы. L2 — задача 2-го уровня в Worksection, L3 — задача 3-го уровня в Worksection. Возвращайтесь сюда, чтобы свериться с правилами.',
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
        'Зарабатывайте кристаллы 💎, поддерживайте стрики, помогайте коллегам и обменивайте кристаллы 💎 на награды в магазине. Загляните в «Достижения» и «Магазин» в боковом меню — там тоже будут подсказки при первом посещении.',
      placement: 'center',
    },
  ],
}
