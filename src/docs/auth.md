# auth

Единственный способ входа в приложение — OAuth2 через Worksection. Supabase используется только как хранилище пользователей и сессий.

## Логика работы

**OAuth flow (два route handler-а):**

1. `GET /api/auth/worksection` — генерирует случайный `state`, устанавливает `HttpOnly` cookie `ws_oauth_state` напрямую на объект redirect-ответа (не через `next/headers` — иначе cookie не прикрепляется к redirect), редиректит на `https://worksection.com/oauth2/authorize`.
2. `GET /signin-worksection` — callback от Worksection. Проверяет `state` (CSRF). Обменивает `code` на токены через `POST /oauth2/token`. Получает данные пользователя через `POST /oauth2/resource` — WS возвращает `first_name`, `last_name`, `email` (с произвольным регистром), `id`, `account_url`. Email нормализуется в нижний регистр (Supabase хранит email lowercase). Имя собирается из `first_name + last_name`. Пытается создать пользователя через `createUser`; если ошибка "уже существует" — находит через `listUsers` по нормализованному email. Делает upsert в `worksection_tokens` через admin-клиент (обходит RLS — сессии ещё нет). Генерирует magic link через `admin.auth.admin.generateLink`, берёт `hashed_token` из `properties` (не из URL action_link), вызывает `supabase.auth.verifyOtp({ token_hash, type: 'magiclink' })` — устанавливает сессионные cookie. Редиректит на `/`.

**Middleware (`src/middleware.ts`):**

Выполняется на каждый запрос. Использует `createSupabaseMiddlewareClient(request)` из `src/config/supabase.ts` — возвращает `{ supabase, response }`, где `response` мутируется внутри `setAll` для передачи сессионных cookie (в middleware недоступен `next/headers`). Вызывает `getUser()` для валидации сессии. Публичные пути: `/login`, `/api/auth/*`, `/signin-worksection`. Без сессии на непубличном пути → редирект на `/login`. С сессией на `/login` → редирект на `/`.

**Модуль `src/modules/auth/`:**

Серверный API для остальной части приложения. `getCurrentUser` читает текущего пользователя из сессии. `getWorksectionTokens` читает токены из БД через серверный клиент (с учётом RLS — пользователь видит только свою строку). `refreshWorksectionToken` вызывает `POST /oauth2/refresh`, обновляет строку в `worksection_tokens` через admin-клиент, возвращает новый `access_token`.

**Утилита `src/lib/worksectionApi.ts`:**

Единая точка для HTTP-запросов к Worksection API. Перед запросом проверяет `expires_at`: если до истечения менее 5 минут — вызывает `refreshWorksectionToken`. Строит URL как `account_url + "/api/oauth2" + path`, добавляет `Authorization: Bearer`.

## Зависимости

- **Supabase** — `auth.users` (пользователи), таблица `public.worksection_tokens` (токены)
- **Worksection OAuth2 API** — `authorize`, `token`, `resource`, `refresh` эндпоинты
- `src/config/supabase.ts` — три клиента: браузерный, серверный, admin
- `src/config/worksection.ts` — URL эндпоинтов и env-переменные
- `src/lib/types.ts` — `WorksectionTokenRow`

## Типы

`WorksectionTokenRow` (`src/lib/types.ts`) — строка таблицы `worksection_tokens`. `expires_at` хранится как ISO 8601 строка, приводить через `new Date(expires_at)` перед сравнением.

`AuthUser` (`src/modules/auth/types.ts`) — публичное представление текущего пользователя: `id`, `email`, `fullName` (из `user_metadata.full_name`).

## Queries

- `getCurrentUser()` — текущий пользователь из Supabase-сессии или `null`
- `getWorksectionTokens(userId)` — токены WS для пользователя или `null`; использует серверный клиент с RLS

## Actions

- `refreshWorksectionToken(userId)` — обновляет `access_token` и `refresh_token` в БД, возвращает новый `access_token`. Бросает исключение при ошибке (внутренняя утилита, не вызывается из форм)

## Ограничения

- `client_secret` и `SUPABASE_SECRET_KEY` только в `.env.local`, никогда не попадают в браузер
- `redirect_uri` в `.env.local` должен совпадать побайтово с зарегистрированным в Worksection OAuth-приложении
- Worksection требует HTTPS для `redirect_uri` — в dev использовать `next dev --experimental-https` (уже настроено в `package.json`)
- Email от Worksection всегда нормализовать в lowercase перед сравнением и созданием — Supabase хранит email в нижнем регистре, WS возвращает в произвольном
- `hashed_token` брать из `linkData.properties.hashed_token`, не парсить из `action_link` URL — параметр в URL называется иначе
- `refreshWorksectionToken` не вызывать из client компонентов — только server-side
- Client Components не должны импортировать из `@/modules/auth` (index.ts) — это тянет `next/headers` в клиентский бандл. Из Client Component импортировать только напрямую: `signOut` из `@/modules/auth/actions`, типы из `@/modules/auth/types`
- Middleware использует `createSupabaseMiddlewareClient` из `src/config/supabase.ts` — не `createSupabaseServerClient`, потому что в middleware недоступен `next/headers`
- `listUsers({ perPage: 1000 })` при поиске пользователя по email — допустимо для корпоративного приложения с ограниченным числом пользователей
