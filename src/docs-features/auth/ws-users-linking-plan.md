# План: Исправление связки auth ↔ ws_users

## Контекст

При входе через Worksection создаётся запись в `profiles`. Триггер `trg_link_ws_user_on_profile_insert` должен связать `profiles` с `ws_users` — прописать `user_id` в ws_users. Но триггер срабатывает только на INSERT, а callback делает upsert — при повторных входах связка не устанавливается.

## Проблема простыми словами

```
Сотрудник входит первый раз → INSERT в profiles → триггер ищет его в ws_users
  ├─ ws_users есть → связал ✓
  └─ ws_users нет (синк не прошёл) → не связал ✗

Сотрудник входит повторно → UPDATE profiles → триггер НЕ срабатывает
  └─ Даже если ws_users уже появился — связка потеряна навсегда ✗
```

## Что делаем

### Шаг 1. Добавить UPDATE ws_users в callback

**Файл:** `src/app/signin-worksection/route.ts`
**Где:** после upsert profiles (строка ~165)

Добавить явный UPDATE ws_users при каждом входе:

```ts
// Связь ws_users с auth-пользователем
await admin
  .from('ws_users')
  .update({ user_id: userId })
  .eq('email', email)
  .is('user_id', null)
```

Безопасно: если ws_users нет — 0 строк обновлено. Если уже связан — условие `user_id IS NULL` не даст перезаписать.

### Шаг 2. Оставить триггер как страховку

Триггер `trg_link_ws_user_on_profile_insert` не удалять, не менять. Он страхует на случай если callback изменится. Двойное срабатывание безопасно — оба проверяют `user_id IS NULL`.

### Шаг 3. Обновить документацию

**Файл:** `src/docs/auth.md` — добавить описание нового механизма связки.

## Что НЕ трогаем

- **department/team маппинг** (строки 158-159) — проверено, данные корректны
- **RLS на gamification-таблицы** — отложено, не критично пока всё через service_role
- **Reconciliation SQL/VPS** — не нужен, callback при каждом входе решает проблему

## Статус проблем из plan.md коллеги

| # | Проблема | Решаем? | Статус |
|---|---|---|---|
| 1 | Триггер только на INSERT | Да | UPDATE ws_users в callback |
| 2 | ws_user появился позже первого входа | Да | Тот же UPDATE — при следующем входе свяжет |
| 3 | RLS не использует ws_users.user_id | Отложено | Не критично пока всё через service_role |
| 4 | department/team перепутаны | Нет | Проверено — маппинг правильный |

## Затрагиваемые файлы

| Файл | Изменение |
|---|---|
| `src/app/signin-worksection/route.ts` | Добавить UPDATE ws_users после upsert profiles |
| `src/docs/auth.md` | Обновить описание связки auth ↔ ws_users |
