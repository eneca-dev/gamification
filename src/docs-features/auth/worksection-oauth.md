# Аутентификация через Worksection OAuth2

## Цель

Реализовать единственный способ входа в приложение — через OAuth2 Worksection.
Пользователи приложения — только сотрудники организации в Worksection.
После успешного входа создаётся Supabase-сессия; Worksection-токены хранятся
в отдельной таблице БД и автоматически обновляются при истечении.

---

## Контекст и ограничения

- Worksection **не является** встроенным провайдером Supabase — flow реализуется вручную
- Supabase выступает только как хранилище пользователей и сессий
- `access_token` WS живёт 24 часа, `refresh_token` — 1 месяц
- Авторизационный код WS живёт 10 минут — обменивать немедленно в callback
- `client_secret` никогда не покидает сервер
- Все роуты приложения, кроме `/login`, требуют валидной Supabase-сессии
- `redirect_uri` должен быть HTTPS-адресом (в dev — ngrok или продовый домен)

---

## Эндпоинты Worksection OAuth2

| Назначение | URL |
|---|---|
| Авторизация | `https://worksection.com/oauth2/authorize` |
| Обмен кода на токен | `https://worksection.com/oauth2/token` |
| Обновление токена | `https://worksection.com/oauth2/refresh` |
| Данные пользователя | `https://worksection.com/oauth2/resource` |

Ответ `/oauth2/token`:
```json
{
  "token_type": "Bearer",
  "expires_in": 86400,
  "access_token": "...",
  "refresh_token": "...",
  "account_url": "https://[account].worksection.com"
}
```

---

## Этапы реализации

### Этап 0: Регистрация OAuth-приложения в Worksection

**Описание:**
Создать OAuth-приложение в панели Worksection, чтобы получить `client_id` и `client_secret`.
Без этого шага запустить flow невозможно.

**Шаги:**

1. Войти в аккаунт Worksection с правами администратора
2. Перейти: Настройки аккаунта → Интеграции → OAuth-приложения → Создать приложение
3. Заполнить форму:
   - **Название:** произвольное (например, `Gamification App`)
   - **Redirect URI:** `https://<your-domain>/api/auth/callback`
     - В dev: использовать ngrok или аналог — WS требует HTTPS
     - В prod: реальный домен
   - **Scopes:** `users_read` (минимум для получения email и имени)
4. Сохранить — получить `client_id` и `client_secret`
5. Внести в `.env.local`:
   ```
   WORKSECTION_CLIENT_ID=...
   WORKSECTION_CLIENT_SECRET=...
   WORKSECTION_REDIRECT_URI=https://<your-domain>/api/auth/callback
   ```

**Важно:**
- `client_secret` — показывается один раз, сохранить немедленно
- `redirect_uri` в `.env.local` должен совпадать **точно** с тем, что указан в приложении WS
- В dev удобно создать два приложения WS: одно с ngrok-адресом, второе с продовым

**Затрагиваемые объекты:**
- Worksection Dashboard → OAuth-приложения
- `.env.local`

**Зависимости:** нет

**Статус: ⏳ Требует действия**

---

### Этап 1: Supabase — настройка проекта и клиента

**Описание:**
Установить пакеты, получить ключи из Supabase Dashboard, заполнить `.env.local`,
создать конфиг-файлы клиентов.

**Затрагиваемые файлы:**
- `.env.local` — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `WORKSECTION_CLIENT_ID`, `WORKSECTION_CLIENT_SECRET`, `WORKSECTION_REDIRECT_URI`
- `src/config/supabase.ts` — три клиента: браузерный, серверный, админский
- `src/config/worksection.ts` — URL эндпоинтов и env-переменные Worksection

**Зависимости:** Этап 0

**Статус: ✅ Выполнен**

---

### Этап 2: Миграция БД — таблица `worksection_tokens`

**Описание:**
Создать таблицу для хранения Worksection-токенов, привязанных к пользователям Supabase.
Настроить RLS. Добавить TypeScript-тип.

---

**Шаг 2.1 — Выполнить SQL в Supabase Dashboard** ✅

Путь: Dashboard → [твой проект] → SQL Editor → New query

Вставить и нажать Run:

```sql
create table public.worksection_tokens (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  access_token  text not null,
  refresh_token text not null,
  account_url   text not null,
  expires_at    timestamptz not null,
  updated_at    timestamptz default now()
);

alter table public.worksection_tokens enable row level security;

create policy "own tokens" on public.worksection_tokens
  for all using (user_id = auth.uid());
```

**Что означает каждое поле:**
- `user_id` — первичный ключ, внешний ключ на `auth.users(id)`. `on delete cascade` — при удалении пользователя из Supabase его токены удаляются автоматически. Связь один-к-одному: у каждого пользователя одна строка с токенами
- `access_token` — JWT от Worksection, живёт 24 часа. Используется в заголовке `Authorization: Bearer` при запросах к WS API
- `refresh_token` — живёт 1 месяц. Используется для получения нового `access_token` без повторного входа пользователя
- `account_url` — URL аккаунта организации (пример: `https://eneca.worksection.com`). Нужен при каждом запросе к WS API — базовый адрес уникален для каждой организации
- `expires_at` — момент истечения `access_token`. Перед каждым запросом к WS API сравниваем с `now()`: если истёк — сначала рефрешим, потом запрашиваем
- `updated_at` — время последнего обновления строки. Нужно для отладки и аудита

**Что такое RLS и зачем:**
Row Level Security — защита на уровне строк в PostgreSQL. Без неё любой пользователь
через браузерный клиент Supabase мог бы прочитать токены других пользователей.
Политика `user_id = auth.uid()` — пользователь обращается только к своей строке.

`createSupabaseAdminClient()` (Secret key) обходит RLS автоматически — именно через него
записываем токены в callback после OAuth, потому что в тот момент Supabase-сессии ещё нет.

---

**Шаг 2.2 — Проверить результат**

Dashboard → Table Editor → убедиться что таблица `worksection_tokens` появилась.
На ней должна гореть иконка щита 🛡 — признак включённого RLS.

---

**Шаг 2.3 — Добавить TypeScript-тип** ✅

Файл: `src/lib/types.ts` — создан.

```ts
export interface WorksectionTokenRow {
  user_id: string
  access_token: string
  refresh_token: string
  account_url: string
  expires_at: string   // ISO 8601, приводить через new Date(expires_at)
  updated_at: string
}
```

---

**Затрагиваемые объекты:**
- Supabase Dashboard → SQL Editor
- `src/lib/types.ts` — тип `WorksectionTokenRow`

**Зависимости:** Этап 1

**Статус: ✅ Выполнен**

---

### Этап 3: Route Handlers — OAuth flow

**Описание:**
Два эндпоинта реализуют полный Authorization Code Flow.

**`GET /api/auth/worksection`** — старт:
1. Генерирует случайный `state` (crypto.randomUUID)
2. Сохраняет `state` в `HttpOnly` cookie (срок 5 минут)
3. Строит URL авторизации WS со scope `users_read` (минимум для получения email)
4. Редиректит пользователя на `https://worksection.com/oauth2/authorize`

**`GET /api/auth/callback`** — завершение:
1. Читает `state` из query и cookie — если не совпадает, возвращает 400
2. Удаляет `state` cookie
3. POST на `https://worksection.com/oauth2/token` → получает `access_token`, `refresh_token`, `account_url`
4. POST на `https://worksection.com/oauth2/resource` → получает `email`, `name`, `id` (WS user id)
5. Через Supabase Admin API: ищет юзера по email (`getUserByEmail`), если нет — создаёт (`createUser`)
6. Upsert в `worksection_tokens` (service role, обходит RLS)
7. Генерирует sign-in link через Admin API → обменивает на сессию → устанавливает cookie
8. Редирект на `/`

**Затрагиваемые файлы:**
- `src/app/api/auth/worksection/route.ts`
- `src/app/api/auth/callback/route.ts`

**Затрагиваемые файлы (фактические):**
- `src/app/api/auth/worksection/route.ts` — старт flow
- `src/app/signin-worksection/route.ts` — callback (путь совпадает с `WORKSECTION_REDIRECT_URI`)

**Зависимости:** Этап 1, Этап 2

**Статус: ✅ Выполнен**

---

### Этап 4: Модуль `auth`

**Описание:**
Публичный API для работы с auth-данными в остальной части приложения.

**Структура:**
```
src/modules/auth/
  types.ts      — WorksectionToken, AuthUser
  queries.ts    — getWorksectionTokens(userId), getCurrentUser()
  actions.ts    — refreshWorksectionToken(userId)
  index.ts      — реэкспорты публичного API
```

**`queries.ts`:**
- `getWorksectionTokens(userId)` — читает токены из БД (серверный клиент)
- `getCurrentUser()` — возвращает текущего Supabase-пользователя из сессии

**`actions.ts`:**
- `refreshWorksectionToken(userId)` — POST на `https://worksection.com/oauth2/refresh`, upsert в БД, возвращает новый `access_token`

**Зависимости:** Этап 1, Этап 2

**Статус: ✅ Выполнен**

---

### Этап 5: Утилита `worksectionApi`

**Описание:**
Единая точка для HTTP-запросов к Worksection API. Автоматически рефрешит токен
если `expires_at` < now + 5 минут.

**Затрагиваемые файлы:**
- `src/lib/worksectionApi.ts`

**Интерфейс:**
```ts
worksectionApi(userId: string, path: string, options?: RequestInit): Promise<Response>
```

**Логика:**
1. Читает токены через `getWorksectionTokens(userId)`
2. Если `expires_at - 5min < now` → вызывает `refreshWorksectionToken(userId)` → использует новый токен
3. Делает `fetch` на `account_url + "/api/oauth2" + path` с заголовком `Authorization: Bearer <token>`

**Зависимости:** Этап 4

**Примечание:** Создавать только после того, как появится первый реальный потребитель WS API.
Если пока потребителей нет — этот этап откладывается.

**Статус: ✅ Выполнен**

---

### Этап 6: Middleware — защита роутов

**Описание:**
Проверяет наличие Supabase-сессии на каждый запрос. Публичные роуты: `/login`, `/api/auth/*`, `/signin-worksection`.

**Затрагиваемые файлы:**
- `src/middleware.ts`

**Логика:**
- Матчер: все роуты кроме `_next`, `favicon`, статики
- Нет сессии + не публичный роут → редирект на `/login`
- Есть сессия + роут `/login` → редирект на `/`

**Зависимости:** Этап 1

**Статус: ✅ Выполнен**

---

### Этап 7: Страница логина

**Описание:**
Минималистичная страница с одной кнопкой. Server Component — никаких хуков.

**Затрагиваемые файлы:**
- `src/app/login/page.tsx` — кнопка-ссылка на `/api/auth/worksection`
- `src/app/login/loading.tsx`

**Зависимости:** Этап 6

**Статус: ✅ Выполнен**

---

### Этап 8: Документация модуля

**Затрагиваемые файлы:**
- `src/docs/auth.md`

**Зависимости:** все предыдущие

**Статус: ✅ Выполнен**

---

## Критерии готовности

- [ ] Пользователь без сессии видит только `/login`
- [ ] Клик «Войти» редиректит на Worksection, после согласия — обратно в приложение
- [ ] В `auth.users` появляется запись с email пользователя WS
- [ ] В `worksection_tokens` появляется строка с валидными токенами
- [ ] После перезагрузки страницы сессия сохраняется (cookie-based)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` и `WORKSECTION_CLIENT_SECRET` не попадают в браузер
- [ ] `npm run build` и `npm run lint` проходят без ошибок

---

## Порядок выполнения этапов

```
Этап 0 (регистрация OAuth-приложения в WS)
    └── Этап 1 (Supabase + конфиг) ✅
          └── Этап 2 (миграция БД) ✅
                └── Этап 3 (Route Handlers)
                      └── Этап 4 (модуль auth)
                            └── Этап 5 (worksectionApi) ← только при необходимости
          └── Этап 6 (middleware)
                └── Этап 7 (страница логина)
                      └── Этап 8 (документация)
```

Этапы 3→4 и 6→7 могут идти параллельно после завершения Этапа 2.
