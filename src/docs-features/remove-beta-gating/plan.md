# Снятие бета-гейтинга — открыть доступ всем

## Цель

Завершить режим бета-тестирования: открыть приложение всем авторизованным пользователям
и полностью убрать механику «бета-тестировщиков» — гейт доступа, админские переключатели,
аналитический фильтр в экономик-дашборде и колонку `is_beta_tester` в БД.

Решения по развилкам (согласованы):
- Колонку `is_beta_tester` и параметр `p_beta_only` в RPC — **удалить полностью** (чистая зачистка).
- Фильтр «только бета» в экономик-дашборде — **убрать**, считать по всем.

## Контекст: где живёт бета (карта)

| Слой | Файлы |
|---|---|
| Гейт доступа ко всему приложению | `src/app/(main)/layout.tsx` (стр. 20-23), `src/components/BetaAccessDenied.tsx` |
| Флаг в auth | `src/modules/auth/types.ts` (`isBetaTester`), `src/modules/auth/queries.ts` (чтение из `ws_users`, dev-impersonate) |
| Админ-переключатели «сделать бета-тестером» | `src/modules/admin/components/UsersTable.tsx` (свитч + фильтр «Только бета»), `src/modules/admin/components/BetaToggle.tsx` (`BetaProvider`/`BetaSwitch`), `src/app/(main)/admin/users/[id]/page.tsx`, `src/modules/admin/actions.ts` (`toggleBetaTester`), `src/modules/admin/index.client.ts` |
| Аналитический фильтр + excess | `src/app/(main)/admin/economy/page.tsx`, `src/modules/admin/components/economy/EconomyFilters.tsx`, `EconomyDashboard.tsx`, `LowBalanceSection.tsx`, `src/modules/admin/queries.ts` (`p_beta_only`, `getGratitudeAchievementExcess`), `src/modules/admin/types.ts` |
| База данных | `ws_users.is_beta_tester`; RPC с `p_beta_only` — миграции 051, 052, 053, 076 |
| Косметика текстов | `src/components/dashboard/Leaderboard.tsx`, `DepartmentContest.tsx` («сброшено в связи с началом бета-тестирования») |

## Критерии готовности (Definition of Done)

- [ ] Любой авторизованный пользователь видит приложение (нет `BetaAccessDenied`).
- [ ] В админке нет переключателей «сделать бета-тестером» и фильтра «Только бета».
- [ ] В экономик-дашборде нет фильтра «только бета» и логики excess/`capGratitudeAch`.
- [ ] В коде не осталось упоминаний `is_beta_tester` / `betaOnly` / `p_beta_only` / `toggleBetaTester`.
- [ ] Колонка `ws_users.is_beta_tester` удалена; RPC пересозданы без `p_beta_only`.
- [ ] `npm run build` и `npm run lint` проходят; типы Supabase перегенерированы.
- [ ] Обновлён `src/docs/admin.md`.

## Порядок и зависимость деплоя (важно)

Дроп параметра RPC и дроп колонки — ломающие изменения для БД. Код, который перестаёт
слать `p_beta_only`, и миграция, удаляющая параметр, **должны выехать вместе** (один деплой/PR):
новый код несовместим со старой сигнатурой RPC, и наоборот. Поэтому Этапы 4 (код дашборда) и 5
(миграция) — атомарны: миграция применяется в том же релизе. Внутри миграции: сначала
пересоздать функции, затем дропнуть колонку.

Этап 1 (гейт) самодостаточен и может выехать первым — даёт мгновенный эффект «доступ открыт».

---

## Этапы реализации

### Этап 1: Открыть доступ — убрать гейт

- `src/app/(main)/layout.tsx`: удалить блок `if (user && !user.isBetaTester) return <BetaAccessDenied />`
  и импорт `BetaAccessDenied`.
- Удалить файл `src/components/BetaAccessDenied.tsx`.
- **Зависимости:** нет. Самостоятельный, выезжает первым.
- **Проверка:** не-бета пользователь попадает в приложение.

### Этап 2: Auth — убрать флаг `isBetaTester`

- `src/modules/auth/types.ts`: удалить поле `isBetaTester` из `AuthUser`.
- `src/modules/auth/queries.ts`: убрать чтение `ws_users.is_beta_tester` (стр. 84-93),
  убрать `isBetaTester: true` из dev-impersonate (стр. 53) и из финального объекта (стр. 104).
- **Зависимости:** должен идти после/вместе с Этапом 1 (layout перестаёт читать поле).
- **Риск:** проверить, что `isBetaTester` больше нигде не читается (grep).

### Этап 3: Админ — убрать переключатели «сделать бета-тестером»

- `src/modules/admin/components/UsersTable.tsx`: удалить свитч беты (стр. 178-190 фильтр-чип
  «Только бета», стр. 494-510 свитч в строке), стейт `betaOnly`, `handleToggleBeta`,
  пропсы `onToggleBeta` по всей цепочке, импорт `toggleBetaTester`, фильтрацию по `is_beta_tester`.
- Удалить файл `src/modules/admin/components/BetaToggle.tsx` (`BetaProvider`/`BetaSwitch`/контекст).
- `src/app/(main)/admin/users/[id]/page.tsx`: убрать обёртку `<BetaProvider>` (стр. 77) и связанный UI.
- `src/modules/admin/actions.ts`: удалить `toggleBetaTester` (стр. 142-169).
- `src/modules/admin/index.client.ts`: убрать экспорт `toggleBetaTester`.
- `src/modules/admin/types.ts`: убрать `is_beta_tester` из `AdminUserRow` (стр. 33).
- **Зависимости:** независим от Этапа 4, но колонку дропаем только в Этапе 5.
- **Проверка:** страница `/admin/users` и `/admin/users/[id]` рендерятся без свитчей беты.

### Этап 4: Экономик-дашборд — убрать фильтр «только бета» и excess-логику

Фильтр «только бета» и связка `capGratitudeAch` → `getGratitudeAchievementExcess`
(коррекция дублей благодарностей **только у бета-тестеров**) обесмысливаются и технически
сломаются после дропа колонки — удаляем целиком.

- `src/app/(main)/admin/economy/page.tsx`: убрать `betaOnly`/`params.beta`, `capGratAch`,
  вызов `getGratitudeAchievementExcess`, функцию `applyExcessToEarnedTop`, всю математику excess
  (стр. 19-48, 91, 124, 128-161 — упростить до прямого расчёта без вычета excess).
- `src/modules/admin/components/economy/EconomyFilters.tsx`: удалить тоггл «бета» (`handleBeta`,
  стр. 85-145) и тоггл `capGratitudeAch`, пропсы `betaOnly`/`capGratitudeAch`.
- `EconomyDashboard.tsx`: убрать пропсы `betaOnly`, `capGratitudeAch` и их проброс.
- `src/modules/admin/queries.ts`:
  - убрать `p_beta_only` из `getEconomyOverview`, `getEconomyTop`, `getEconomyCategoryBreakdown`,
    `getUsersSortedByBalance`;
  - удалить `getGratitudeAchievementExcess` (стр. 268-309);
  - убрать `is_beta_tester` из маппинга `LowBalanceUser` (стр. 329, 340).
- `src/modules/admin/types.ts`: из `EconomyFilters` убрать `betaOnly` (стр. 255-259);
  из `LowBalanceUser` убрать `is_beta_tester` (стр. 250).
- `src/modules/admin/components/economy/LowBalanceSection.tsx`: убрать бейдж «beta» (стр. 168-176).
- `src/modules/admin/index.ts`: убрать экспорт `getGratitudeAchievementExcess`.
- **Зависимости:** едет в одном релизе с Этапом 5 (см. «Порядок деплоя»).

### Этап 5: Миграция БД 080 — дроп колонки и пересоздание RPC

Новая миграция `supabase/migrations/080_drop_beta_tester.sql`. Затронуто ровно **4 RPC**
(отдельных revoke-cutoff функций с `p_beta_only` нет — 052/053 переопределяют overview/top целиком).

**Точные сигнатуры и источник актуального тела** (для `DROP FUNCTION` + копирования тела):

| Функция | DROP-сигнатура | Тело брать из |
|---|---|---|
| `get_economy_overview` | `(timestamptz, timestamptz, boolean)` | **053** (последнее переопределение) |
| `get_economy_top` | `(timestamptz, timestamptz, boolean, text, text)` | **053** (последнее переопределение) |
| `get_economy_category_breakdown` | `(timestamptz, timestamptz, boolean)` | **051** (единственное определение) |
| `get_user_period_balance` | `(timestamptz, timestamptz, boolean)` | **076** (единственное определение) |

Шаги миграции:
1. `DROP FUNCTION public.<имя>(<сигнатура из таблицы>);` для каждой из 4 функций
   (Postgres не делает `CREATE OR REPLACE` при смене сигнатуры).
2. `CREATE FUNCTION` заново без параметра `p_beta_only` и без условий
   `AND (NOT p_beta_only OR u.is_beta_tester)`. Для `get_user_period_balance` дополнительно
   убрать `is_beta_tester` из `RETURNS TABLE`, `SELECT` и `GROUP BY` (см. 076 стр. 17, 36, 42, 54, 62, 63).
3. `ALTER TABLE ws_users DROP COLUMN is_beta_tester;` — **после** пересоздания функций.
- **Контроль полноты:** `is_beta_tester` в БД присутствует только в этих 4 RPC и в колонке —
  RLS/вью/триггеров со ссылкой нет (проверено). При реализации повторить grep для подстраховки.
- **После применения:** перегенерировать типы — `supabase generate_typescript_types`.
- **Риск:** ошибка в типах аргументов `DROP FUNCTION` (перегрузки). Сверять строго по таблице выше.

### Этап 6: Косметика текстов (минорный)

- `src/components/dashboard/Leaderboard.tsx` (стр. 190) и `DepartmentContest.tsx` (стр. 199):
  убрать ветку «…в связи с началом бета-тестирования», оставить нейтральный текст сброса топа.
- **Зависимости:** нет. Можно приклеить к Этапу 1 или отдельным мелким коммитом.

### Этап 7: Документация и граф

- Обновить `src/docs/admin.md` (убрать описания беты, `toggleBetaTester`, `p_beta_only`, excess).
- Обновить `src/docs/auth.md` если упоминает `isBetaTester`.
- `/graphify . --update` после слияния (затронуто > 1 модуля + миграции).

---

## Маппинг на dev-pipeline

- **Фаза 0:** ветка `feature/remove-beta-gating`, DoD — см. выше.
- **Фаза 1:** этот документ. → вызов 🤖 Pragmatic Architect для проверки на over-engineering.
- **Фаза 2:** этапы 1→7 циклами (план этапа → ревью → реализация → 🤖 Cache/Clean Code Guardian →
  тест → code review → коммит). Один этап = один коммит.
- **Фаза 3:** интеграционный прогон под не-админ/не-бета ролью, финальная проверка агентами, PR в main.

## Риски и заметки

- **Ломающий деплой БД:** Этапы 4 и 5 строго в одном релизе (несовместимость сигнатур RPC).
- **Excess-логика:** удаление меняет цифры экономик-дашборда (KPI «Заработано», топы, балансы) —
  это ожидаемо, т.к. коррекция была бета-only. Зафиксировать в PR.
- **Dev-impersonate** ставил `isBetaTester: true` — после снятия гейта поле не нужно, но проверить,
  что удаление не ломает остальной dev-tools флоу.
- **Минимальный diff:** не рефакторить соседнюю логику экономики (designerFilter, группы отделов) —
  трогаем только бета-связанное.
