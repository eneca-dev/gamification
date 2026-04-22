# Cache Module

Централизованный модуль кеширования на базе **TanStack Query** + **Server Actions**.

## Зависимости (установить перед использованием)

```bash
npm install @tanstack/react-query @tanstack/react-query-devtools
npm install @supabase/ssr @supabase/supabase-js zod
```

## Возможности

- **ActionResult** — унифицированный тип возврата Server Actions
- **Query Keys Factory** — централизованное управление ключами кэша
- **Hook Factories** — фабрики для создания типизированных хуков
- **Optimistic Updates** — мгновенный отклик UI при мутациях
- **Realtime Sync** — автоматическая инвалидация при изменениях в БД

## Структура

```
src/modules/cache/
├── index.ts                      # Public API модуля
├── types/index.ts                # ActionResult, PaginatedActionResult
├── client/query-client.ts        # QueryClient + staleTimePresets
├── keys/query-keys.ts            # Query Keys Factory (пополняется по модулям)
├── providers/query-provider.tsx  # QueryClientProvider + DevTools + Realtime
├── hooks/
│   ├── index.ts                  # Экспорты фабрик
│   ├── use-cache-query.ts        # createCacheQuery, createSimpleCacheQuery, createDetailCacheQuery
│   └── use-cache-mutation.ts     # createCacheMutation, createUpdateMutation, createDeleteMutation
├── actions/
│   └── base.ts                   # safeAction wrapper
├── realtime/
│   ├── config.ts                 # Таблицы → Query Keys (пополняется по модулям)
│   ├── realtime-sync.tsx         # Компонент подписок (без UI)
│   └── index.ts                  # Экспорты
└── utils/action-helpers.ts       # isSuccess, unwrapResult
```

---

## Быстрый старт

### 1. Подключить QueryProvider в layout

```tsx
// src/app/layout.tsx
import { QueryProvider } from "@/modules/cache";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html>
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
```

### 2. Добавить Query Key для нового модуля

```typescript
// src/modules/cache/keys/query-keys.ts
export const queryKeys = {
  achievements: {
    all: ["achievements"] as const,
    lists: () => [...queryKeys.achievements.all, "list"] as const,
    detail: (id: string) =>
      [...queryKeys.achievements.all, "detail", id] as const,
  },
} as const;
```

### 3. Создать Server Action

```typescript
// src/modules/achievements/actions.ts
"use server";

import { createClient } from "@/config/supabase"; // после настройки Supabase
import { safeAction } from "@/modules/cache";
import type { ActionResult } from "@/modules/cache";

export interface Achievement {
  id: string;
  title: string;
  points: number;
}

export async function getAchievements(): Promise<ActionResult<Achievement[]>> {
  return safeAction(async () => {
    const supabase = await createClient();
    const { data, error } = await supabase.from("achievements").select("*");
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  });
}
```

### 4. Создать хук через фабрику

```typescript
// src/modules/achievements/hooks/use-achievements.ts
"use client";

import {
  createSimpleCacheQuery,
  queryKeys,
  staleTimePresets,
} from "@/modules/cache";
import { getAchievements } from "../actions";

export const useAchievements = createSimpleCacheQuery({
  queryKey: queryKeys.achievements.lists(),
  queryFn: getAchievements,
  staleTime: staleTimePresets.slow,
});
```

### 5. Использовать в компоненте

```tsx
"use client";

import { useAchievements } from "@/modules/achievements/hooks/use-achievements";

export function AchievementsList() {
  const { data, isLoading, error } = useAchievements();

  if (isLoading) return <div>Загрузка...</div>;
  if (error) return <div>Ошибка: {error.message}</div>;

  return (
    <ul>
      {data?.map((a) => (
        <li key={a.id}>
          {a.title} — {a.points} 💎
        </li>
      ))}
    </ul>
  );
}
```

---

## API Reference

### Query Factories

#### `createCacheQuery<TData, TFilters>`

Хук для запроса с фильтрами.

```typescript
const useAchievements = createCacheQuery({
  queryKey: (filters) => queryKeys.achievements.list(filters),
  queryFn: (filters) => getAchievements(filters),
  staleTime: staleTimePresets.medium,
});

const { data, isLoading } = useAchievements({ category: "performance" });
```

#### `createSimpleCacheQuery<TData>`

Хук для запроса без фильтров.

```typescript
const useAchievements = createSimpleCacheQuery({
  queryKey: queryKeys.achievements.lists(),
  queryFn: getAchievements,
  staleTime: staleTimePresets.static,
});
```

#### `createDetailCacheQuery<TData>`

Хук для запроса по ID. Если `id === undefined` — запрос не выполняется.

```typescript
const useAchievement = createDetailCacheQuery({
  queryKey: (id) => queryKeys.achievements.detail(id),
  queryFn: (id) => getAchievementById(id),
});

const { data } = useAchievement("ach-123");
const { data } = useAchievement(undefined); // запрос не выполнится
```

### Mutation Factories

#### `createCacheMutation<TInput, TData>`

Базовая фабрика мутации с инвалидацией кэша.

```typescript
const useCreateAchievement = createCacheMutation({
  mutationFn: createAchievement,
  invalidateKeys: [queryKeys.achievements.all],
});
```

#### `createUpdateMutation<TInput, TData>`

Мутация обновления с оптимистичным обновлением списка.
`TInput` и `TData` обязаны иметь поле `id: string`.

```typescript
const useUpdateAchievement = createUpdateMutation({
  mutationFn: updateAchievement,
  listQueryKey: queryKeys.achievements.lists(),
  merge: (item, input) => ({ ...item, ...input }),
  invalidateKeys: [queryKeys.achievements.all],
});
```

#### `createDeleteMutation<TInput, TData>`

Мутация удаления с оптимистичным обновлением списка.

```typescript
const useDeleteAchievement = createDeleteMutation({
  mutationFn: deleteAchievement,
  listQueryKey: queryKeys.achievements.lists(),
  invalidateKeys: [queryKeys.achievements.all],
});
```

### `staleTimePresets`

| Ключ       | Значение | Когда использовать             |
| ---------- | -------- | ------------------------------ |
| `static`   | 10 мин   | Справочники (редко меняются)   |
| `slow`     | 5 мин    | Профили, настройки             |
| `medium`   | 3 мин    | Основные данные (по умолчанию) |
| `fast`     | 2 мин    | Часто обновляемые данные       |
| `realtime` | 1 мин    | Почти realtime данные          |
| `none`     | 0        | Уведомления, без кэширования   |

---

## Query Keys

Все ключи хранятся в `keys/query-keys.ts`. Пополняется по мере создания модулей.

**Правила:**

- Никогда не использовать строковые массивы напрямую в `queryKey`
- Всегда через `queryKeys.<entity>.<method>()`

```typescript
// ❌ Запрещено
queryKey: ["achievements", "list"];

// ✅ Правильно
queryKey: () => queryKeys.achievements.lists();
```

**Паттерн для нового модуля:**

```typescript
myEntity: {
  all: ['my-entity'] as const,
  lists: () => [...queryKeys.myEntity.all, 'list'] as const,
  list: (filters?: MyFilters) => [...queryKeys.myEntity.lists(), filters] as const,
  details: () => [...queryKeys.myEntity.all, 'detail'] as const,
  detail: (id: string) => [...queryKeys.myEntity.details(), id] as const,
},
```

---

## Realtime

Подписки настраиваются в `realtime/config.ts`. Активируются после подключения Supabase.

### Добавление подписки

1. Добавить в `realtime/config.ts`:

```typescript
{
  table: 'achievements',
  invalidateKeys: [queryKeys.achievements.all],
}
```

2. Включить таблицу в Supabase publication:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE achievements;
```

### Отключение Realtime

```tsx
<QueryProvider disableRealtime>{children}</QueryProvider>
```

---

## Troubleshooting

### Данные не обновляются после мутации

`invalidateKeys` должен включать достаточно широкий ключ:

```typescript
invalidateKeys: [queryKeys.achievements.all]; // инвалидирует ВСЕ achievements запросы
```

### TypeScript ошибки в createUpdateMutation / createDeleteMutation

Тип `TInput` и `TData` обязаны содержать `id: string`. Если поле называется иначе — используй `createCacheMutation` с ручной инвалидацией.

### Server Action возвращает ошибку

Убедись что action возвращает `ActionResult<T>`, а не данные напрямую:

```typescript
// ❌ Плохо
return data;

// ✅ Правильно
return { success: true, data };
```
