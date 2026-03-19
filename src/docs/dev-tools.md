# dev-tools

Dev-инструменты для разработки: подмена пользователя (impersonation).

## Логика работы

Impersonation позволяет разработчику просматривать приложение от имени любого сотрудника из `ws_users`,
не требуя регистрации этого сотрудника в auth/profiles.

Механизм: cookie `dev_impersonate` содержит email целевого пользователя.
`getCurrentUser()` в auth-модуле проверяет эту cookie в dev-режиме и возвращает данные из `ws_users`
вместо auth/profiles. Все downstream-запросы работают автоматически, т.к. фильтруют по email.

Защита: работает только при `NODE_ENV === 'development'`. Cookie httpOnly.

## Зависимости
- `ws_users` — источник списка сотрудников (575 записей)
- `auth` модуль — `getCurrentUser()` модифицирован для чтения cookie
- `next/headers` — cookies API

## Actions
- `setImpersonation(email)` — устанавливает cookie, revalidatePath
- `clearImpersonation()` — удаляет cookie, revalidatePath
- `searchUsers(search)` — поиск по ws_users для UI

## Queries
- `searchDevUsers(search, limit)` — поиск активных ws_users по имени/email
- `getDevUserByEmail(email)` — один пользователь для getCurrentUser

## Ограничения
- Только `NODE_ENV === 'development'`
- Impersonated пользователь получает `id: 'dev_<email>'` — не настоящий UUID
- Данные, привязанные к user_id (а не email), не будут видны при impersonation
