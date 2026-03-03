# План: Сохранение профиля пользователя (имя, фамилия, отдел, команда) при регистрации

## Контекст

Сейчас при OAuth-авторизации через Worksection приложение сохраняет пользователя в `auth.users` (с `full_name` в metadata) и токены в `worksection_tokens`. Структурированных данных профиля (имя, фамилия, отдел, команда) нигде нет.

Эндпоинт `/oauth2/resource` возвращает только базовую информацию: email, first_name, last_name. Отдел и команда (`group`) доступны через обычный WS API эндпоинт `{account_url}/api/oauth2?action=get_users` ([документация](https://worksection.com/en/faq/api-user.html)).

## План реализации

### 1. Создать таблицу `profiles` в Supabase

```sql
CREATE TABLE public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  department TEXT,
  team TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);
```

Запись идёт через admin-клиент (обходит RLS), чтение — через серверный клиент (с учётом RLS).

### 2. Добавить тип `ProfileRow` — `src/lib/types.ts`

Добавить интерфейс `ProfileRow` рядом с существующим `WorksectionTokenRow`.

### 3. Расширить тип `AuthUser` — `src/modules/auth/types.ts`

Добавить поля `firstName`, `lastName`, `department`, `team`. Существующее поле `fullName` сохраняется для обратной совместимости.

### 4. Изменить OAuth callback — `src/app/signin-worksection/route.ts`

После upsert токенов и перед созданием magic link:

1. Вызвать WS API `{account_url}/api/oauth2?action=get_users` с Bearer-токеном
2. Найти текущего пользователя по email в ответе
3. Извлечь `department` и `group` (сохраняется как `team`)
4. Upsert в таблицу `profiles` (admin-клиент): first_name, last_name из `/oauth2/resource`, department и team из `get_users`

Обёрнуто в try/catch — если дополнительный API-запрос упадёт, авторизация всё равно пройдёт (department/team будут null).

Профиль обновляется при **каждом входе**, поэтому изменения в Worksection отражаются автоматически.

### 5. Обновить `getCurrentUser()` — `src/modules/auth/queries.ts`

После получения пользователя из сессии — запросить таблицу `profiles` для заполнения новых полей `AuthUser`. Корректно обрабатывает отсутствие строки профиля (для пользователей, которые логинились до этого изменения).

### 6. Обновить экспорты — `src/modules/auth/index.ts`

Новых экспортов не требуется (`getCurrentUser` и `AuthUser` уже экспортируются).

### 7. Обновить документацию — `src/docs/auth.md`

Добавить таблицу `profiles` в зависимости, описать новые поля в секции типов, отметить вызов WS API в описании OAuth-потока.

## Файлы для изменения

| Файл                                  | Изменение                                                   |
| ------------------------------------- | ----------------------------------------------------------- |
| `src/lib/types.ts`                    | Добавить интерфейс `ProfileRow`                             |
| `src/modules/auth/types.ts`           | Расширить `AuthUser` четырьмя новыми полями                 |
| `src/app/signin-worksection/route.ts` | Добавить вызов WS API + upsert профиля                      |
| `src/modules/auth/queries.ts`         | Обновить `getCurrentUser()` для подтягивания данных профиля |
| `src/docs/auth.md`                    | Документировать таблицу profiles и новый поток              |

## Проверка

1. `npm run build` — нет ошибок типов
2. Войти через Worksection — проверить, что строка в `profiles` создана в Supabase
3. Вызвать `getCurrentUser()` в серверном компоненте — проверить, что department/team заполнены
4. Войти повторно — убедиться, что профиль обновлён (upsert, не дубликат)
