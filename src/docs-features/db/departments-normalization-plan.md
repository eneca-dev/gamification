# План: Нормализация departments и teams

> **Статус:** отложено (YAGNI). Реализовать когда понадобятся соревнования между отделами.

## Контекст

Сейчас в `profiles` поля `department` и `team` хранятся как TEXT — строки из Worksection API. Для группировки/фильтрации этого достаточно. Но для соревнований между отделами (подсчёт очков, рейтинги отделов) нужны стабильные ID — значит, отдельные таблицы.

## Связь

В Worksection team (group) принадлежит department. Связь: department → teams (1:N).

## Схема БД

```sql
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(name, department_id)
);

-- Изменения в profiles: заменить TEXT-поля на FK
ALTER TABLE public.profiles
  ADD COLUMN department_id UUID REFERENCES public.departments(id),
  ADD COLUMN team_id UUID REFERENCES public.teams(id);

-- После миграции данных:
ALTER TABLE public.profiles
  DROP COLUMN department,
  DROP COLUMN team;
```

RLS: чтение departments/teams — для всех авторизованных (нужно для UI-фильтров и рейтингов). Запись — только через admin-клиент.

```sql
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read departments"
  ON public.departments FOR SELECT
  USING (auth.role() = 'authenticated');

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read teams"
  ON public.teams FOR SELECT
  USING (auth.role() = 'authenticated');
```

## Миграция существующих данных

```sql
-- 1. Заполнить departments из текущих profiles
INSERT INTO public.departments (name)
SELECT DISTINCT department FROM public.profiles
WHERE department IS NOT NULL
ON CONFLICT (name) DO NOTHING;

-- 2. Заполнить teams
INSERT INTO public.teams (name, department_id)
SELECT DISTINCT p.team, d.id
FROM public.profiles p
JOIN public.departments d ON d.name = p.department
WHERE p.team IS NOT NULL
ON CONFLICT (name, department_id) DO NOTHING;

-- 3. Проставить FK в profiles
UPDATE public.profiles p
SET department_id = d.id
FROM public.departments d
WHERE d.name = p.department;

UPDATE public.profiles p
SET team_id = t.id
FROM public.teams t
JOIN public.departments d ON d.id = t.department_id
WHERE t.name = p.team AND d.name = p.department;

-- 4. Удалить текстовые поля
ALTER TABLE public.profiles DROP COLUMN department;
ALTER TABLE public.profiles DROP COLUMN team;
```

## Изменения в коде

### 1. Типы (`src/lib/types.ts`)

Добавить `DepartmentRow`, `TeamRow`. Обновить `ProfileRow` — заменить `department/team: string | null` на `department_id/team_id: string | null`.

### 2. OAuth callback (`src/app/signin-worksection/route.ts`)

Изменить шаг upsert профиля:
1. Upsert department по name (admin) → получить `department_id`
2. Upsert team по (name, department_id) (admin) → получить `team_id`
3. Upsert profiles с `department_id` и `team_id`

Ресурсозатратность: +2 простых upsert при логине — незначительно для корпоративного приложения.

### 3. Queries (`src/modules/auth/queries.ts`)

`getCurrentUser()` — JOIN profiles → departments + teams, возвращать имена отделов/команд в `AuthUser`.

### 4. AuthUser (`src/modules/auth/types.ts`)

Оставить `department: string | null` и `team: string | null` в публичном типе (имена, не ID). Добавить `departmentId` и `teamId` если понадобятся для соревнований.

### 5. Документация

Обновить `src/docs/auth.md` — добавить таблицы в зависимости, описать новый flow.

## Файлы для изменения

| Файл | Изменение |
|------|-----------|
| Supabase (SQL) | Создать таблицы, миграция данных |
| `src/lib/types.ts` | Добавить `DepartmentRow`, `TeamRow`, обновить `ProfileRow` |
| `src/modules/auth/types.ts` | Добавить `departmentId`, `teamId` в `AuthUser` |
| `src/app/signin-worksection/route.ts` | Upsert departments/teams перед profiles |
| `src/modules/auth/queries.ts` | JOIN в `getCurrentUser()` |
| `src/docs/auth.md` | Обновить документацию |

## Когда реализовывать

При старте работы над фичей "соревнования между отделами". Миграция простая — данные уже есть в profiles, нужно только разнести по таблицам.
