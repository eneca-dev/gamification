# feed

Модуль вкладок «Лента отдела» и «Лента команды» на странице `/activity`.

## Логика работы

Страница `/activity` поддерживает три режима через URL-параметр `?feed=company|dept|team` (по умолчанию `company`).

При переключении на `dept` или `team` рендерится вложенная таблица с данными текущего пользователя:
- `dept` — иерархия: строка отдела → команды → сотрудники
- `team` — плоская таблица: строка команды → сотрудники

Данные показываются за текущий календарный месяц, совпадая с периодом достижений.

## Зависимости

- `ws_users` — список сотрудников (department_code, team, is_active)
- `view_top_pers_revit` / `view_top_pers_ws` — личные кристаллы (user_id, total_coins, department_code)
- `view_top_team_revit` / `view_top_team_ws` — contest_score команды
- `view_top_dept_revit` / `view_top_dept_ws` — contest_score отдела
- `ach_awards` — достижения (entity_id, entity_type, period_start)
- `v_gratitudes_feed_new` — благодарности (recipient_name, recipient_department, created_at)
- `@/modules/auth` — getCurrentUser() → user.department, user.team

## Типы

- `PersonFeedRow` — строка сотрудника (revitCoins, wsCoins, achievementsCount, gratitudesCount)
- `TeamFeedRow` — строка команды + members[]
- `DepartmentFeedData` — строка отдела + teams[]
- `TeamFeedData` — строка команды + members[] (без уровня отдела)

## Queries

- `getDepartmentFeedData(dept, monthStart, monthEnd)` — два шага: сначала ws_users, затем 8 параллельных запросов. Merge по user_id (default 0 для отсутствующих в ранкинг-вьюхах). Кэш 5 мин, тег `dept-feed-${dept}`
- `getTeamFeedData(team, dept, monthStart, monthEnd)` — аналогично, только для одной команды. Тег `team-feed-${team}`

## Ограничения

- Вьюхи рейтингов содержат только пользователей с ненулевыми баллами — пользователи с 0 кристаллов видны через merge с ws_users
- Благодарности per-user считаются по совпадению recipient_name = first_name + last_name (ws_users не имеет email)
- Revit-кристаллы в строке команды/отдела — contest_score из ranking views, не сумма личных
- `?feed=dept` и `?feed=team` не рендерятся, если у пользователя нет department/team в профиле
