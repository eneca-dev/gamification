# Code Review — коммит 622aa45

**feat: integrate Supabase for authentication and enhance project structure**
Дата: 2026-03-02

---

## Blocker (необходимо исправить до мержа)

### 1. `signin-worksection/route.ts` — пагинация listUsers ограничена 1000 ✔

```ts
const { data: usersData } = await admin.auth.admin.listUsers({ perPage: 1000 });
const existing = usersData?.users.find((u) => u.email === email);
```

При > 1000 пользователей существующий юзер не найдётся — auth сломается.
Заменить на поиск по email через таблицу `auth.users` или использовать
`getUserByEmail`, если доступно в версии SDK.

### 2. `signin-worksection/route.ts` — нет Zod-валидации ответов Worksection API ✔

Поля `access_token`, `refresh_token`, `account_url`, `expires_in`, `email`
принимаются напрямую из `tokenRes.json()` и `resourceRes.json()` без проверки.
Если поле отсутствует — `undefined` попадёт в upsert молча.

Решение: добавить Zod-схемы для обоих ответов, использовать `safeParse()`.

---

## Should fix (нарушения правил CLAUDE.md)

### 3. Хардкод цветов в `login/page.tsx` и `login/loading.tsx`

Нарушение: _"Запрещено использовать произвольные HEX, RGB, HSL значения напрямую"_.

Файлы: `src/app/login/page.tsx:27,49`, `src/app/login/loading.tsx:10`

```tsx
// Нарушение
style={{ background: 'linear-gradient(135deg, #4CAF50, #66bb6a)' }}
style={{ boxShadow: '0 4px 16px rgba(76,175,80,0.3)' }}
```

Решение: добавить CSS-переменные в `globals.css`, использовать их.

### 4. `src/lib/worksectionApi.ts` — нарушение изоляции модулей ✔

```ts
import { getWorksectionTokens, refreshWorksectionToken } from "@/modules/auth";
```

Нарушение: _"Модули не импортируют друг друга напрямую — взаимодействие через src/lib/ или props"_.
`src/lib/` должен быть независим от `src/modules/`.

Решение: `worksectionApi.ts` принимает токен снаружи через параметр, либо
переносится внутрь модуля `auth`.

### 5. `Sidebar.tsx` — импорт в обход `index.ts` ✔

```ts
import { signOut } from "@/modules/auth/actions";
import type { AuthUser } from "@/modules/auth/types";
```

Нарушение: _"Публичный API модуля — только через index.ts"_.
Комментарий объясняет причину (граница `'use server'`), но решение неверное.

Решение: переместить `signOut` в отдельный клиентский wrapper или
использовать `'use server'` inline внутри функции, а не на уровне файла.

### 6. `actions.ts` — `refreshWorksectionToken` бросает исключение ✔

Нарушение паттерна CLAUDE.md: _"Всегда возвращают типизированный результат:_
_`{ success: true, data: T } | { success: false, error: string }`"_.

Функция помечена `'use server'` (файл `actions.ts`), но ведёт себя как
серверная утилита — бросает исключения вместо возврата типизированного результата.

Решение: вынести в `src/lib/worksection/refreshToken.ts` без `'use server'`,
оставив в `actions.ts` только публичные Server Actions.

---

## Nice to fix (минорные)

### 7. `src/docs-features/` не зафиксирована в CLAUDE.md ✔

Конвенция: `src/docs/<module>.md`. Новая директория `src/docs-features/`
не описана в правилах. Нужно либо перенести в `src/docs/`, либо добавить
описание структуры в CLAUDE.md.

### 8. Порядок импортов в `Sidebar.tsx` ✔

```ts
import { LogOut } from "lucide-react"; // сторонняя — должна быть второй
import Link from "next/link"; // Next.js — должна быть первой
```

Правило: React/Next.js → сторонние → `@/` → локальные → типы.

### 9. `Sidebar.tsx:135` — `mockUser.balance` не заменён

```tsx
<CoinStatic amount={mockUser.balance} size="md" />
```

Реальный `user` из Supabase передаётся в компонент, но баланс берётся
из мока. Если заглушка намеренная — добавить комментарий с указанием задачи.

---

## Что сделано хорошо

- OAuth flow (`/api/auth/worksection` → redirect → `/signin-worksection`) корректный
- CSRF защита через state cookie: `httpOnly: true`, `maxAge: 300`
- Разделение Supabase-клиентов по контексту: browser / server / middleware / admin
- `satisfies WorksectionTokenRow` при upsert — явная типизация
- `getUser()` в middleware вместо `getSession()` — верно по требованию Supabase SSR
- Вынос `(main)/layout.tsx`: `user` передаётся через props в Sidebar — правильная граница Server/Client

---

## Итог

| Приоритет   | Кол-во |
| ----------- | ------ |
| Blocker     | 2      |
| Should fix  | 4      |
| Nice to fix | 3      |
