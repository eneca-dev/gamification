// --- Adoption Dashboard Types ---
// Используется только в /admin/adoption (аналитика внедрения геймификации).
// Все метрики считаются по когорте проектировщиков: отделы с group_type =
// 'designer' из admin_department_groups. Период ДО = 29–30.06.2026.

// Охват: размер когорты и в какой мере она вовлечена (карточки в блоке «Обзор»)
export interface AdoptionCoverageData {
  company_total: number       // все активные сотрудники компании
  total_employees: number     // активные проектировщики (когорта)
  profiles_count: number      // из когорты авторизовались в веб-приложении
  profiles_pct: number        // profiles_count / total_employees * 100
  earned_total: number        // кристаллов заработано когортой с 01.07
  earned_logged_pct: number   // из них заработано вошедшими в приложение, %
}

// Вход в приложение по отделам и командам выборки (скрытый вложенный список)
export interface AdoptionLoginUser {
  name: string
  logged_in: boolean
}
export interface AdoptionLoginTeam {
  team: string | null   // название команды, null — вне команд / без команды
  total: number
  logged_in: number
  pct: number
  users: AdoptionLoginUser[]  // не вошедшие первыми
}
export interface AdoptionLoginDepartment {
  department: string
  total: number
  logged_in: number
  pct: number
  teams: AdoptionLoginTeam[]  // по возрастанию pct
}

// График «Пользователи»: вход в систему и личные улучшения vs 29–30.06
export interface AdoptionUsersDay {
  day: string                    // YYYY-MM-DD, календарные дни
  logged_in: number              // накопительно: авторизовались в системе
  // Улучшения vs собственный уровень 29–30.06; null до запуска — точки не рисуются.
  // Вкладка «Вся выборка» — суммарные линии, вкладка сравнения — split по входу
  improved_ws: number | null               // работают по WS лучше уровня ДО, вся выборка
  improved_revit: number | null            // запускают Revit-плагины чаще, вся выборка
  improved_ws_logged: number | null        // то же, только вошедшие в приложение
  improved_revit_logged: number | null
  improved_ws_not_logged: number | null    // то же, не вошедшие (квази-контроль)
  improved_revit_not_logged: number | null
}

export interface AdoptionRevitDay {
  day: string                 // YYYY-MM-DD, только рабочие дни
  users: number               // уникальных пользователей плагинов за день
}

// График зелёных дней в обзоре берёт ряд из AdoptionWorksectionData.daily
export interface AdoptionOverviewData {
  total_cohort: number        // всего проектировщиков (горизонталь на графике)
  users_daily: AdoptionUsersDay[]
  revit_daily: AdoptionRevitDay[]
  login_by_department: AdoptionLoginDepartment[]  // по возрастанию pct отдела
}

// Дневной ряд дисциплины WS: зелёные дни и два вида нарушений, всё — доли от отслеживаемых
export interface AdoptionWsDay {
  day: string
  green_pct: number           // доля зелёных вердиктов
  wrong_task_pct: number      // % с вердиктом «часы в задачу не в статусе "В работе"»
  no_report_pct: number       // % без отчёта в тот же день
}

// Строка скрытого списка нарушителей: человек и число красных дней по причине
export interface AdoptionRedUser {
  name: string
  department: string | null
  days: number                // красных дней с этой причиной за период ПОСЛЕ
}

// Эффект вовлечения: дисциплина WS до/после для одной группы когорты
export interface AdoptionLoginEffectGroup {
  users: number               // человек в группе (с вердиктами за период)
  green_before: number        // % зелёных 29–30.06
  green_after: number         // % зелёных с 01.07
}

// Объединённый блок «Дисциплина Worksection»: зелёные дни + два нарушения
// (доли от отслеживаемых, чем меньше — тем лучше; абсолюты — для подсказок)
export interface AdoptionWorksectionData {
  green_before: number        // % зелёных вердиктов, 29–30.06
  green_after: number         // % зелёных вердиктов, с 01.07
  wrong_task_before: number   // % отслеживаемых с нарушением «часы не в ту задачу»
  wrong_task_after: number
  no_report_before: number    // % отслеживаемых без отчёта в тот же день
  no_report_after: number
  wrong_task_day_before: number  // случаев в среднем на рабочий день
  wrong_task_day_after: number
  no_report_day_before: number
  no_report_day_after: number
  daily: AdoptionWsDay[]
  no_report_users: AdoptionRedUser[]    // красные дни «нет отчёта», с 01.07, по убыванию дней
  wrong_task_users: AdoptionRedUser[]   // красные дни «отчёт в задачу не в "В работе"», с 01.07
  logged: AdoptionLoginEffectGroup      // вошли в приложение
  not_logged: AdoptionLoginEffectGroup  // не вошли (квази-контрольная группа)
}

// Эффект вовлечения по Revit: активность в плагинах до/после для одной группы выборки
export interface AdoptionRevitEffectGroup {
  users: number               // человек в группе
  active_before: number       // % группы, запускавших плагины в средний рабочий день, 29–30.06
  active_after: number        // то же с 01.07
}

// Дневная точка графика Revit: активные пользователи и запуски за рабочий день
export interface AdoptionPluginsDay {
  day: string               // YYYY-MM-DD, только рабочие дни
  users: number             // уникальных пользователей плагинов за день
  launches: number          // суммарных запусков за день
}

// Запуски Revit-плагинов: интенсивность использования.
// ДО = июнь (стабильная месячная база), ПОСЛЕ = с 01.07
export interface AdoptionPluginsData {
  daily_active_before: number    // активных в средний рабочий день
  daily_active_after: number
  launches_day_before: number    // запусков за рабочий день
  launches_day_after: number
  new_users_after: number        // активны с 01.07, но не пользовались плагинами в июне
  weekly_audience: number        // средняя недельная аудитория по полным неделям (стабильна)
  daily: AdoptionPluginsDay[]    // по рабочим дням с 29.06
  total_cohort: number           // размер выборки (для контекста)
  effect_logged: AdoptionRevitEffectGroup      // вошли в приложение
  effect_not_logged: AdoptionRevitEffectGroup  // не вошли (квази-контрольная группа)
}

// Активность когорты в системе: кристаллы, благодарности, магазин, чат-бот
export interface AdoptionSideEffectsData {
  earners_count: number           // получили хотя бы одно начисление с 01.07
  earners_pct: number             // % от когорты
  spent_total: number             // потрачено кристаллов с 01.07
  balance_total: number           // кристаллов на балансах когорты сейчас
  balance_avg: number             // средний баланс на зарабатывающего
  gratitude_total: number
  gratitude_senders: number
  gratitude_recipients: number
  shop_orders_total: number       // только реальные покупки (без «Второй жизни»)
  shop_orders_unique_users: number
  second_life_total: number       // куплено «Вторых жизней» (защита стрика)
  second_life_users: number
  chatbot_messages_total: number
  chatbot_unique_users: number
  ws_streak_holders: number       // держат WS-стрик (серия ≥ 1 без нарушений)
  ws_streak_7plus: number         // из них серия 7+ дней
  revit_streak_holders: number    // держат Revit-стрик
  revit_streak_7plus: number
}
