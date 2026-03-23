# auth

Единственный способ входа в приложение — OAuth2 через Worksection. Supabase используется только как хранилище пользователей и сессий.

## Логика работы

**OAuth flow (два route handler-а):**

1. `GET /api/auth/worksection` — генерирует случайный `state`, устанавливает `HttpOnly` cookie `ws_oauth_state` напрямую на объект redirect-ответа (не через `next/headers` — иначе cookie не прикрепляется к redirect), редиректит на `https://worksection.com/oauth2/authorize`.
2. `GET /signin-worksection` — callback от Worksection. Проверяет `state` (CSRF). Обменивает `code` на токены через `POST /oauth2/token` — ответ валидируется Zod-схемой `wsTokenResponseSchema`. Получает данные пользователя через `POST /oauth2/resource` — валидируется `wsResourceResponseSchema`. WS возвращает `first_name`, `last_name`, `email` (с произвольным регистром). Email нормализуется в нижний регистр. Имя собирается из `first_name + last_name`. Пытается создать пользователя через `createUser`; если ошибка "уже существует" — находит через RPC `get_user_id_by_email` по нормализованному email. Делает upsert в `worksection_tokens` через admin-клиент (обходит RLS — сессии ещё нет). Дополнительно вызывает WS API `{account_url}/api/oauth2?action=get_users` для получения `department` и `group` (team) текущего пользователя; делает upsert в `profiles` (admin-клиент). Ошибка получения department/team не блокирует вход — поля будут null. Профиль обновляется при каждом входе. Генерирует magic link через `admin.auth.admin.generateLink`, берёт `hashed_token` из `properties` (не из URL action_link), вызывает `supabase.auth.verifyOtp({ token_hash, type: 'magiclink' })` — устанавливает сессионные cookie. Редиректит на `/`.

**Middleware (`src/middleware.ts`):**

Выполняется на каждый запрос. Использует `createSupabaseMiddlewareClient(request)` из `src/config/supabase.ts` — возвращает `{ supabase, response }`, где `response` мутируется внутри `setAll` для передачи сессионных cookie (в middleware недоступен `next/headers`). Вызывает `getUser()` для валидации сессии. Публичные пути: `/login`, `/api/auth/*`, `/signin-worksection`. Без сессии на непубличном пути → редирект на `/login`. С сессией на `/login` → редирект на `/`. Для путей `/admin/*` проверяет `is_admin` из `user.app_metadata` — не-админы редиректятся на `/`.

**Модуль `src/modules/auth/`:**

Серверный API для остальной части приложения. `getCurrentUser` читает текущего пользователя из сессии + данные профиля из таблицы `profiles`. `getWorksectionTokens` читает токены из БД через серверный клиент (с учётом RLS — пользователь видит только свою строку). `refreshWorksectionToken` (`refreshToken.ts`) вызывает `POST /oauth2/refresh`, обновляет строку в `worksection_tokens` через admin-клиент, возвращает новый `access_token`. `worksectionApi` (`worksectionApi.ts`) — единая точка для HTTP-запросов к WS API с авто-рефрешем токенов.

**Структура файлов модуля:**

- `actions.ts` — Server Actions: `signOut`
- `queries.ts` — серверные запросы: `getCurrentUser`, `getWorksectionTokens`
- `refreshToken.ts` — внутренняя утилита рефреша токенов (не Server Action)
- `worksectionApi.ts` — HTTP-клиент к Worksection API с авто-рефрешем
- `types.ts` — типы и Zod-схемы (`AuthUser`, `wsTokenResponseSchema`, `wsResourceResponseSchema`)
- `index.ts` — полный серверный API (queries, actions, schemas, worksectionApi)
- `index.client.ts` — клиентобезопасные экспорты (`signOut`, `AuthUser` type)

## Зависимости

- **Supabase** — `auth.users` (пользователи), таблица `public.worksection_tokens` (токены), таблица `public.profiles` (профили: имя, фамилия, отдел, команда), таблица `public.ws_users` (справочник сотрудников геймификации), RPC `get_user_id_by_email`
- **Worksection OAuth2 API** — `authorize`, `token`, `resource`, `refresh` эндпоинты
- **Worksection REST API** — `get_users` (department, group) — вызывается при каждом входе для актуализации профиля
- `src/config/supabase.ts` — три клиента: браузерный, серверный, admin
- `src/config/worksection.ts` — URL эндпоинтов и env-переменные
- `src/lib/types.ts` — `WorksectionTokenRow`, `ProfileRow`

## Типы

`WorksectionTokenRow` (`src/lib/types.ts`) — строка таблицы `worksection_tokens`. `expires_at` хранится как ISO 8601 строка, приводить через `new Date(expires_at)` перед сравнением.

`ProfileRow` (`src/lib/types.ts`) — строка таблицы `profiles`: `user_id`, `first_name`, `last_name`, `department` (nullable), `team` (nullable), `created_at`, `updated_at`.

`AuthUser` (`src/modules/auth/types.ts`) — публичное представление текущего пользователя: `id`, `email`, `fullName`, `firstName`, `lastName`, `department` (nullable), `team` (nullable), `isAdmin`, `wsUserId` (nullable). Данные профиля подтягиваются из таблицы `profiles`. `isAdmin` и `wsUserId` читаются из JWT claims (`user.app_metadata`), добавляемых pg-функцией `custom_access_token_hook` — 0 дополнительных DB-запросов.

`wsTokenResponseSchema`, `wsResourceResponseSchema` (`src/modules/auth/types.ts`) — Zod-схемы валидации ответов от Worksection OAuth эндпоинтов.

## Queries

- `getCurrentUser()` — текущий пользователь из Supabase-сессии + данные из `profiles` или `null`. Если строка в `profiles` отсутствует — firstName/lastName будут пустыми строками, department/team будут null. `isAdmin` и `wsUserId` читаются из `user.app_metadata` (JWT claims)
- `getWorksectionTokens(userId)` — токены WS для пользователя или `null`; использует серверный клиент с RLS

## Actions

- `signOut()` — выход из системы: вызывает `supabase.auth.signOut()`, редирект на `/login`

## Утилиты

- `refreshWorksectionToken(userId)` (`refreshToken.ts`) — обновляет `access_token` и `refresh_token` в БД, возвращает новый `access_token`. Бросает исключение при ошибке. Не Server Action — внутренняя серверная утилита
- `worksectionApi(userId, path, options?)` (`worksectionApi.ts`) — HTTP-клиент к Worksection API. Перед запросом проверяет `expires_at`: если до истечения менее 5 минут — вызывает `refreshWorksectionToken`. Строит URL как `account_url + "/api/oauth2" + path`, добавляет `Authorization: Bearer`

## Связь с геймификацией

При каждом успешном входе callback должен обновлять `ws_users.user_id` — связывать запись сотрудника с Supabase Auth аккаунтом:

```sql
UPDATE public.ws_users
SET user_id = <auth.uid()>
WHERE email = lower(<email из JWT>)
  AND user_id IS NULL;
```

Это необходимо чтобы `my_ws_user_id()` RLS-функция корректно резолвила текущего пользователя. Без этого шага пользователь видит данные геймификации, но RPC функции (`cancel_transaction`, `add_manual_adjustment`) не смогут определить его `employee_id`. Обновление делается только если `user_id IS NULL` — при повторных входах не трогает уже связанную запись.

## Ограничения

- `client_secret` и `SUPABASE_SECRET_KEY` только в `.env.local`, никогда не попадают в браузер
- `redirect_uri` в `.env.local` должен совпадать побайтово с зарегистрированным в Worksection OAuth-приложении
- Worksection требует HTTPS для `redirect_uri` — в dev использовать `next dev --experimental-https` (уже настроено в `package.json`)
- Email от Worksection всегда нормализовать в lowercase перед сравнением и созданием — Supabase хранит email в нижнем регистре, WS возвращает в произвольном
- `hashed_token` брать из `linkData.properties.hashed_token`, не парсить из `action_link` URL — параметр в URL называется иначе
- `refreshWorksectionToken` и `worksectionApi` не вызывать из client компонентов — только server-side
- Client Components импортируют из `@/modules/auth/index.client` (не из `index.ts` — тот тянет `next/headers` в клиентский бандл)
- Middleware использует `createSupabaseMiddlewareClient` из `src/config/supabase.ts` — не `createSupabaseServerClient`, потому что в middleware недоступен `next/headers`
- Поиск существующего пользователя — через Supabase RPC `get_user_id_by_email`, не через `listUsers`
