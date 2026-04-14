# help

Справочный раздел для пользователей. Статьи хранятся в Supabase, рендерятся как markdown, доступны для редактирования через админку.

## Логика работы

Статьи хранятся в таблице `help_articles` с markdown-контентом. Группируются по папкам (folder). На клиенте рендерятся через react-markdown + remark-gfm. Поиск — простой `includes()` фильтр по title и content.

Кэширование: страницы кэшируются Next.js (server components). После редактирования в админке вызывается `revalidatePath('/help')` для сброса кэша.

## Зависимости

- Таблица: `help_articles`
- npm: `react-markdown`, `remark-gfm`
- CSS: `.help-content` стили в `globals.css`

## Типы

- `HelpArticle` — полная строка из таблицы (id, slug, folder, folder_label, title, content, sort_order, is_published, updated_at)
- `HelpFolder` — группировка: folder, folder_label, articles[]

## Actions

- `updateHelpArticle(input)` — обновление статьи. Revalidate: `/help`, `/admin/help`
- `createHelpArticle(input)` — создание новой статьи. Revalidate: `/help`, `/admin/help`
- `deleteHelpArticle(slug)` — удаление статьи. Revalidate: `/help`, `/admin/help`

## Queries

- `getHelpArticles()` — все опубликованные статьи, отсортированные по folder + sort_order
- `getHelpArticle(slug)` — одна опубликованная статья по slug
- `getHelpFolders()` — сгруппированные по папкам для навигации
- `getAllHelpArticles()` — все статьи включая неопубликованные (для админки)

## Ограничения

- slug уникален (UNIQUE constraint)
- RLS: чтение для всех, запись только для admin (ws_users.is_admin)
- Папки (folder) не хранятся отдельно — текстовые поля на статье
