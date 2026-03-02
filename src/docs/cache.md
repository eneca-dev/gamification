# cache

Инфраструктурный модуль: централизованный клиентский кэш на TanStack Query + Server Actions. Все другие модули используют его фабрики вместо прямого TanStack Query API.

## Логика работы

`QueryProvider` оборачивает приложение (подключён в `src/app/layout.tsx`) — создаёт `QueryClient` и монтирует realtime-подписки через `RealtimeSync`.

Фабрики хуков (`createCacheQuery`, `createSimpleCacheQuery`, `createDetailCacheQuery`) принимают Server Action и ключ кэша, возвращают готовый типизированный хук. Фабрики мутаций (`createCacheMutation`, `createUpdateMutation`, `createDeleteMutation`) принимают Server Action и список ключей для инвалидации после успешной мутации. `createUpdateMutation` и `createDeleteMutation` применяют оптимистичное обновление — UI меняется до ответа сервера, при ошибке откатывается.

`safeAction` — обёртка для Server Actions: перехватывает исключения и возвращает `ActionResult` вместо необработанного throw.

Realtime-подписки настраиваются в `realtime/config.ts`: таблица БД → список ключей для инвалидации. При любом изменении в таблице соответствующие ключи инвалидируются автоматически.

## Зависимости

- `@tanstack/react-query` — ядро кэша
- `@tanstack/react-query-devtools` — DevTools (только dev)
- Supabase Realtime — канал подписок на изменения в БД

## Типы

`ActionResult<T>` — унифицированный возвращаемый тип всех Server Actions: `{ success: true, data: T } | { success: false, error: string }`. Все actions в проекте обязаны возвращать этот тип.

`PaginatedActionResult<T>` — расширение `ActionResult` с полями `total`, `page`, `pageSize`.

## Публичный API

**Фабрики хуков:**
- `createSimpleCacheQuery({ queryKey, queryFn, staleTime })` — хук без параметров
- `createCacheQuery({ queryKey, queryFn, staleTime })` — хук с фильтрами (queryKey и queryFn принимают filters)
- `createDetailCacheQuery({ queryKey, queryFn })` — хук по ID; если `id === undefined` — запрос не выполняется

**Фабрики мутаций:**
- `createCacheMutation({ mutationFn, invalidateKeys })` — базовая мутация с инвалидацией
- `createUpdateMutation({ mutationFn, listQueryKey, merge, invalidateKeys })` — обновление с оптимистичным UI; `TInput` и `TData` обязаны иметь `id: string`
- `createDeleteMutation({ mutationFn, listQueryKey, invalidateKeys })` — удаление с оптимистичным UI; то же ограничение на `id`

**Утилиты:**
- `safeAction(fn)` — обёртка для Server Action, возвращает `ActionResult`
- `isSuccess(result)` — type guard для `ActionResult`
- `unwrapResult(result)` — возвращает `data` или бросает исключение с `error`
- `staleTimePresets` — именованные пресеты: `static` (10 мин), `slow` (5 мин), `medium` (3 мин), `fast` (2 мин), `realtime` (1 мин), `none` (0)

**Ключи кэша:**
- `queryKeys` — фабрика ключей, пополняется в `keys/query-keys.ts` по мере создания модулей

## Ограничения

- Прямые импорты из `@tanstack/react-query` в компонентах и модулях запрещены — только через фабрики из `@/modules/cache`
- `createUpdateMutation` и `createDeleteMutation` требуют `id: string` в типах input и data — при другой структуре использовать базовый `createCacheMutation`
- Все Server Actions обязаны возвращать `ActionResult<T>` — использовать `safeAction` или формировать вручную
- Realtime-подписки требуют включения таблицы в Supabase publication (`ALTER PUBLICATION supabase_realtime ADD TABLE ...`)
- `QueryProvider` должен быть подключён выше любого компонента, использующего хуки кэша
