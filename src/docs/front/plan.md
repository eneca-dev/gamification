сори, что влезаю, но вот тут немного про связь юзеров - я просто думала, тчто ты еще ее не смотрела и попросила составить план реализации
 
### Что НЕ работает / Проблемы
| # | Проблема | Последствие |
|---|---|---|
| 1 | Триггер срабатывает только на INSERT, а callback делает upsert | При повторных входах `ws_users.user_id` не обновляется. Если при первом входе ws_user ещё не было в БД — связь навсегда потеряна |
| 2 | Нет обратной связи: если ws_user появился позже (синк прошёл после первого входа) — user_id никогда не заполнится | Новые сотрудники, зарегистрировавшиеся до первого синка ws_users, останутся без связи |
| 3 | `ws_users.user_id` не используется в RLS gamification-таблиц | RLS на gamification-данные пока использует `my_ws_user_id()` (по email), но для будущих фич (магазин, cancel_transaction) нужна прямая связь |
| 4 | Баг в callback: department и team перепутаны (строка 158-159) | `profiles.department` = WS group, `profiles.team` = WS department (перевёрнуто). Данные в profiles сейчас корректны — видимо, исправлялись вручную или триггером |
## Предложение
### Вариант A: Расширить callback (рекомендуемый)
Добавить явный UPDATE `ws_users.user_id` в callback после upsert профиля. Не полагаться только на триггер.
**Изменения:**
#### 1. Добавить UPDATE ws_users в callback
В файле `src/app/signin-worksection/route.ts` после upsert `profiles` (строка ~165):
```ts
// Связь ws_users с auth-пользователем
await admin
  .from('ws_users')
  .update({ user_id: userId })
  .eq('email', email)
  .is('user_id', null)
```
Условие `user_id IS NULL` — не перезаписываем уже связанные записи. Выполняется при **каждом** входе, не только при первом. Если ws_user ещё не существует — UPDATE просто ничего не обновит (0 rows affected), не ломает flow.
#### 2. Исправить баг department/team
В файле `src/app/signin-worksection/route.ts` строки 158-159:
```diff
- department: team,
- team: department,
+ department,
+ team,
```
#### 3. Оставить триггер как страховку
Триггер `trg_link_ws_user_on_profile_insert` не удалять — он служит страховочным механизмом на случай, если callback изменится. Двойное обновление безопасно из-за `WHERE user_id IS NULL`.
### Вариант B: Расширить триггер на INSERT OR UPDATE
Изменить триггер, чтобы он срабатывал и на UPDATE:
```sql
DROP TRIGGER IF EXISTS trg_link_ws_user_on_profile_insert ON profiles;
CREATE TRIGGER trg_link_ws_user_on_profile_upsert
  AFTER INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION link_ws_user_on_profile_insert();
```
**Минус:** триггер будет срабатывать при любом UPDATE profiles, даже при изменении только `updated_at`. Лишняя нагрузка.
### Вариант C: Фоновый скрипт reconciliation
Добавить в VPS-оркестратор шаг reconciliation после `sync-ws-users`:
```sql
UPDATE ws_users wu
SET user_id = p.user_id
FROM profiles p
WHERE p.email = wu.email
  AND wu.user_id IS NULL;
```
**Плюс:** ловит все edge cases (поздний синк, ручное создание пользователей).
**Минус:** задержка до следующего запуска оркестратора.
## Рекомендация
**Вариант A + C** — максимальная надёжность:
- A — мгновенная связка при каждом входе (покрывает 99% случаев)
- C — ежедневная reconciliation для edge cases (ws_user появился через синк после первого входа)
## Затрагиваемые файлы
| Файл | Изменение |
|---|---|
| `src/app/signin-worksection/route.ts` | Добавить UPDATE ws_users + исправить баг department/team |
| `src/docs/auth.md` | Обновить раздел "Связь с геймификацией" |
| VPS-скрипт `sync-ws-users.ts` (внешний репо) | Добавить reconciliation шаг |
## Масштаб
Quick Pipeline — 2-3 файла, минимальные изменения.
## Открытые вопросы
1. **Нужно ли чинить существующие данные?** — Сейчас только 2 записи ws_users связаны. Нужен ли одноразовый SQL для reconciliation всех существующих profiles↔ws_users?
2. **Reconciliation в VPS-скриптах** — добавлять в `sync-ws-users.ts` или отдельным шагом в оркестратор?
3. **Подтверди перепутанные department/team** — в callback строки 158-159 department и team присваиваются наоборот. Данные в profiles сейчас выглядят корректными — возможно, были исправлены вручную. Нужно подтвердить, что это действительно баг.