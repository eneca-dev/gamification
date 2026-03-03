# Ревью незакоммиченных изменений (auth module)

Базовый коммит: `622aa45`
Затронутые файлы: `route.ts`, `Sidebar.tsx`, `types.ts`, `queries.ts`, `actions.ts`, `index.ts`, `index.client.ts`, `refreshToken.ts`, `worksectionApi.ts`, `lib/types.ts`

---

## Красные флаги

### 1. BUG: department и team перепутаны местами ✔

**Файл:** `src/app/signin-worksection/route.ts:157-158`

```
department: team,
team: department,
```

Переменная `department` (полученная из `wsUser.department`) записывается в поле `team`, а `team` (из `wsUser.group`) — в поле `department`. Значения перепутаны.

**Исправление:**

```
department: department,
team: team,
```

---

## Чеклист

### 1. Типизация

- [x] Нет `any`
- [x] Props через `interface` (`SidebarProps`)
- [x] Внешние данные через Zod — `wsTokenResponseSchema`, `wsResourceResponseSchema` в route.ts
- [ ] **`refreshToken.ts:25`** — ответ refresh endpoint (`res.json()`) не валидируется Zod. В `route.ts` эту проблему исправили, но в `refreshToken.ts` тот же паттерн остался без валидации
- [x] Типы в правильных местах — `ProfileRow` в `lib/types.ts`, `AuthUser` в `modules/auth/types.ts`
- [x] Нет дублирования типов

**Замечание:** `route.ts:103` — `existingId as string` — type assertion на результат RPC. Безопаснее проверить `typeof existingId === 'string'`.

**Замечание:** `route.ts:138` — inline type assertion `as Array<{...}>` на ответ WS API `get_users`. Этот endpoint тоже стоит валидировать Zod-схемой (или хотя бы минимальной проверкой структуры).

### 2. Структура файлов и импорты

- [ ] **`Sidebar.tsx:1-5`** — порядок импортов нарушен: `usePathname` (Next) стоит после `LogOut` (lucide-react). Next-импорты должны идти первыми
- [x] Только алиас `@/`
- [x] Относительные пути — только внутри модуля auth
- [x] Один компонент = один файл
- [x] Модули не импортируют друг друга

**Правильный порядок в Sidebar.tsx:**

```ts
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
```

### 3. React-компоненты

- [x] Только функциональные компоненты
- [x] `'use client'` только где нужно (Sidebar — хуки, события)
- [x] Дефолтные значения через деструктуризацию
- [x] Компонент отображает данные, не содержит побочной логики

### 4. Server vs Client

- [x] Нет fetch на клиенте
- [x] Server Component не импортирован внутри Client Component
- [x] Client импортирует из `index.client.ts` — корректная граница

### 5. Server Actions

- [x] `signOut` в `actions.ts` с `'use server'`
- [x] `signOut` не принимает данных — Zod не требуется
- [x] Клиентский вызов через нативную `<form action={signOut}>` — корректно

### 6. Стили

- [x] _(Sidebar содержит inline-стили и хардкоженые цвета, но эти строки не менялись в текущем diff — pre-existing issue, не регрессия)_

### 7. Состояние

- [x] Серверные данные не дублируются в useState
- [x] Pathname через usePathname

### 8. Именование

- [x] Всё соответствует конвенциям

### 9. Качество кода

- [x] Нет `console.log`
- [x] Нет дублирования логики
- [x] Нет кода "на будущее"
- [x] Нет `TODO`/`FIXME`
- [ ] **`route.ts:151-160`** — результат `profiles` upsert не проверяется на ошибку. Для `worksection_tokens` upsert (строка 122) ошибка проверяется — стоит быть консистентным

### 10. Безопасность

- [x] Нет секретов в коде
- [x] Входные данные от WS валидируются Zod
- [x] Публичные ключи через `@/config/`

### 11. Документация

- [x] `src/docs/auth.md` обновлён

---

## Итого

| Severity         | Кол-во | Описание                                                                             |
| ---------------- | ------ | ------------------------------------------------------------------------------------ |
| BUG              | 1      | department/team перепутаны в profiles upsert                                         |
| Нарушение правил | 2      | Zod-валидация refresh ответа; порядок импортов в Sidebar                             |
| Замечание        | 3      | `as string` assertion, inline `as Array`, отсутствие проверки ошибки profiles upsert |
