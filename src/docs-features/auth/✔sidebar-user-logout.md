# Sidebar — имя пользователя и logout ✅

## Цель

Заменить захардкоженные имя и аватар в нижней части Sidebar на реальные данные из сессии.
Добавить кнопку выхода рядом с именем.

## Текущее состояние

`src/components/Sidebar.tsx` использует `user` из `src/lib/data.ts` — моковые данные.

## Что нужно сделать

**`src/app/(main)/layout.tsx`** — Server Component, вызывает `getCurrentUser()` и передаёт результат в Sidebar через props.

**`src/components/Sidebar.tsx`** — принимает `AuthUser` через props вместо импорта из `data.ts`. Блок профиля строится из `AuthUser.fullName` (имя) и инициалов из него же (аватар).

**`src/modules/auth/actions.ts`** — добавить `signOut()`: вызывает `supabase.auth.signOut()`, затем `redirect('/login')`.

**Кнопка logout** — отдельный маленький Client Component рядом с блоком профиля (`'use client'`, `<form action={signOut}>`). Остальная часть Sidebar остаётся Server Component.

## Зависимости

- `src/modules/auth/queries.ts` — `getCurrentUser()`
- `src/modules/auth/actions.ts` — `signOut()`
- `src/components/Sidebar.tsx`
- `src/app/(main)/layout.tsx`
