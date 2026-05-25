# Форма обратной связи

## Цель

Дать пользователям возможность отправить баг-репорт или предложение прямо из приложения. Записи зеркалируются в Airtable (основное хранилище) и в Supabase (для быстрого отображения в админке).

---

## Архитектурные решения

- **Точка входа**: плавающая кнопка, видна на всех страницах (root layout), открывает модальное окно
- **Изображения**: загружаются в Supabase Storage bucket `feedback-images` → публичный URL → передаётся в Airtable как attachment
- **Airtable**: одна таблица, поле `Type` = `bug` | `suggestion`
- **Зеркало**: при создании записи сохраняем и в Airtable, и в Supabase таблицу `feedback`
- **Админка**: читает из Supabase (быстро, без лишних запросов к Airtable)

---

## Этапы реализации

### Этап 1: Инфраструктура

**Файлы:**
- `src/config/airtable.ts` — типизированный клиент (fetch-обёртка над REST API Airtable)
- Миграция Supabase: таблица `feedback`
- Supabase Storage: bucket `feedback-images` (public)

**Схема таблицы `feedback`:**
```
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
created_at    timestamptz DEFAULT now()
type          text CHECK (type IN ('bug', 'suggestion'))
title         text NOT NULL
description   text
image_url     text
airtable_id   text
user_id       uuid REFERENCES auth.users(id)
```

**Airtable таблица (ID: `tblchPw2DdhHkD0FD`, base: `appKHrxgAJFFZeeQO`):**
```
header           (fldbTgkgheVDnlfes) — text — заголовок
description      (fldz90unwgy7fAw7L) — long text — описание / что происходит
expected_behavior(fld0pKl6Freqhr5CZ) — long text — ожидаемое поведение (только для bug)
type             (fldtxdRsD60iC4KbV) — single select — "bug" | "suggestion"
attachments      (fldqJ2vT1ZgQG2Zox) — attachment — [{url, filename}]
user_name        (fldY7fSBdKnHqtgHn) — single select + typecast — имя пользователя
user_department  (fldXQxFFchqVih7k5) — single select + typecast — отдел
user_team        (fldypPFm2KvcvvZ9j) — single select + typecast — команда
status           (fldy852IVLPcFrU8O) — single select + typecast — статус (создаём как "new")
row_number       (fldwKxgnhR2WcjYTy) — formula — авто, read-only
number           (fldhSw8tvhRdUolIk) — auto number — авто, read-only
created_at       (fldCkXdsdrnz7i4Wt) — created time — авто, read-only
```
Поля `user_name`, `user_department`, `user_team`, `status` — Single Select с `typecast: true`
(создаём новые варианты при первой записи).

**Зависимости:** нет

---

### Этап 2: Серверная логика

**Файлы:**
- `src/modules/feedback/types.ts` — Zod схема `FeedbackSchema`, типы `FeedbackRecord`, `FeedbackType`
- `src/modules/feedback/actions.ts` — `submitFeedback(data)`:
  1. Валидация через Zod `safeParse`
  2. Если есть изображение — загрузить в Supabase Storage, получить URL
  3. Создать запись в Airtable
  4. Зеркалить в Supabase (с `airtable_id` из ответа)
  5. `revalidatePath('/admin/feedback')`
- `src/modules/feedback/queries.ts` — `getFeedbackList()`: чтение из Supabase с сортировкой по `created_at DESC`, тег `'feedback'`
- `src/modules/feedback/index.ts`, `index.client.ts`

**Зависимости:** Этап 1

---

### Этап 3: UI — форма (плавающая кнопка + модал)

**Файлы:**
- `src/modules/feedback/components/FeedbackButton.tsx` — плавающая кнопка (`'use client'`), позиция `fixed bottom-6 right-6`
- `src/modules/feedback/components/FeedbackModal.tsx` — модальное окно (`'use client'`):
  - Переключатель типа: Баг / Предложение (2 кнопки-таба)
  - Поле: заголовок (required)
  - Поле: описание (textarea)
  - Загрузка изображений: множественный выбор (несколько файлов), превью каждого с кнопкой удаления
  - Кнопка отправки с `isPending` из `useTransition`
  - Успех: уведомление + закрытие модала
  - Ошибка: сообщение под формой
- Интеграция `FeedbackButton` в `src/app/(main)/layout.tsx`

**Зависимости:** Этап 2

---

### Этап 4: Страница админки

**Файлы:**
- `src/app/(main)/admin/feedback/page.tsx` — Server Component, читает через `getFeedbackList()`
- `src/app/(main)/admin/feedback/loading.tsx` — скелетон таблицы
- `src/modules/feedback/components/FeedbackTable.tsx` — таблица с колонками: тип (бейдж), заголовок, описание (truncated), автор, дата, скриншот (ссылка)
- Добавить пункт навигации в `src/app/(main)/admin/layout.tsx` или сайдбар

**Зависимости:** Этап 2

---

### Этап 5: Документация и финал

**Файлы:**
- `src/docs/feedback.md` — документация модуля

**Зависимости:** Этапы 1–4

---

## Переменные окружения

```env
AIRTABLE_API_KEY=pat...                     # Personal Access Token
AIRTABLE_BASE_ID=appKHrxgAJFFZeeQO          # ID базы (зафиксирован)
AIRTABLE_FEEDBACK_TABLE_ID=tblchPw2DdhHkD0FD  # ID таблицы (зафиксирован)
```

---

## Критерии готовности

- [ ] Плавающая кнопка видна на всех страницах приложения
- [ ] Форма позволяет выбрать тип (баг / предложение)
- [ ] Можно прикрепить изображение с превью
- [ ] Запись появляется в Airtable после отправки
- [ ] Запись зеркалируется в Supabase
- [ ] Админ-страница `/admin/feedback` показывает список
- [ ] Валидация: заголовок обязателен, изображение опционально
- [ ] Ошибки API не приводят к краху — показывается сообщение
- [ ] Сборка `npm run build` проходит без ошибок
