# dev-tools

Dev-инструменты для разработки: подмена пользователя (impersonation).

## Логика работы

Impersonation позволяет разработчику просматривать приложение от имени любого сотрудника из `ws_users`,
не требуя регистрации этого сотрудника в auth/profiles.

Механизм: cookie `dev_impersonate` содержит email целевого пользователя.
`getCurrentUser()` в auth-модуле проверяет эту cookie в dev-режиме и возвращает данные из `ws_users`
вместо auth/profiles. Все downstream-запросы работают автоматически, т.к. фильтруют по email.

Защита: работает при `NODE_ENV === 'development'` (локальная разработка) либо при
`ENABLE_DEV_TOOLS=true` (dev-стенд, напр. `dev.gamification.eneca.by`). На проде
обе переменные должны отсутствовать/быть false. Cookie httpOnly.

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
- Только при `NODE_ENV === 'development'` или `ENABLE_DEV_TOOLS=true`
- `ENABLE_DEV_TOOLS` — серверная переменная (не `NEXT_PUBLIC_*`), выставляется
  только на dev-деплое, на продакшене не должна быть выставлена
- Impersonated пользователь получает `id: 'dev_<email>'` — не настоящий UUID
- Данные, привязанные к user_id (а не email), не будут видны при impersonation
