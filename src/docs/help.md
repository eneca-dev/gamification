# help

Справочный раздел для пользователей и база знаний чат-бота. Статьи хранятся в Supabase, рендерятся как markdown, доступны для редактирования через админку.

## Логика работы

Статьи хранятся в таблице `help_articles` с markdown-контентом. Папки вынесены в отдельную таблицу `help_folders`, статья ссылается на папку через `folder_id` (FK). При выборке статей папка подтягивается через Supabase relational select (`folder:help_folders(id, slug, label)`). На клиенте рендерятся через react-markdown + remark-gfm. Поиск — простой `includes()` фильтр по title и content.

Флаг `show_in_help` разделяет назначение статей:
- `show_in_help = true` — статья видна пользователям в `/help`
- `show_in_help = false` — статья скрыта от пользователей, но чанкуется и участвует в RAG чат-бота (папка `chatbot`)

Кэширование: страницы кэшируются Next.js (server components). После редактирования в админке вызывается `revalidatePath('/help')` для сброса кэша.

После редактирования любой статьи в `HelpEditor` отображается баннер с кнопкой «Обновить чанки» — она вызывает `triggerReembed()`, который POST-запросом запускает перевекторизацию на FastAPI-агенте.

## Зависимости

- Таблицы: `help_articles`, `help_folders`, `help_article_chunks`, `chatbot_reembed_log`
- npm: `react-markdown`, `remark-gfm`
- CSS: `.help-content` стили в `globals.css`
- Внешний сервис: FastAPI chat-agent (env: `CHAT_AGENT_URL`, `CHAT_AGENT_SECRET`)

## Типы

- `HelpFolder` — папка: id, slug, label, sort_order
- `HelpArticle` — строка из таблицы + вложенная папка через join: id, slug, folder (Pick<HelpFolder, 'id'|'slug'|'label'>), title, content, sort_order, is_published, show_in_help, updated_at
- `HelpFolderWithArticles` — папка со вложенными статьями для навигации: id, slug, label, articles[]
- `HelpChunk` — чанк статьи: id, article_id, slug, chunk_index, content, created_at
- `ReembedLog` — запись лога векторизации: id, started_at, finished_at, status, error

## Actions

- `updateHelpArticle(input)` — обновление статьи, `input.folder_id` — FK на `help_folders`. Revalidate: `/help`, `/admin/help`
- `createHelpArticle(input)` — создание новой статьи, `sort_order` вычисляется в пределах `folder_id`. Revalidate: `/help`, `/admin/help`
- `deleteHelpArticle(slug)` — удаление статьи. Revalidate: `/help`, `/admin/help`
- `triggerReembed()` — POST к FastAPI-агенту `/reembed`. Требует `CHAT_AGENT_URL` и `CHAT_AGENT_SECRET` в env. Возвращает `{ success: true }` или `{ success: false, error }`.

## Queries

- `getHelpArticles()` — опубликованные статьи с `show_in_help = true` для пользовательской справки, с join на папку
- `getHelpArticle(slug)` — одна опубликованная статья по slug, с join на папку
- `getHelpFolders()` — папки из `help_folders` (сортировка по `sort_order`) со вложенными опубликованными статьями (только show_in_help = true), пустые папки отфильтровываются
- `getAllHelpFolders()` — все папки из `help_folders`, отсортированные по `sort_order` (для выпадающего списка в редакторе)
- `getAllHelpArticles()` — все статьи включая неопубликованные, с join на папку (для админки)
- `getChatbotArticlesWithChunks()` — статьи с `show_in_help = false` и их чанки (для `/admin/chatbot`)
- `getLastReembedLog()` — последняя запись из `chatbot_reembed_log`

## Ограничения

- slug статьи уникален (UNIQUE constraint), slug папки уникален (`help_folders.slug`)
- RLS `help_articles`: чтение для всех, запись только для admin (ws_users.is_admin)
- RLS `help_folders`: чтение для всех (`using (true)`), insert/update/delete только для admin
- Папка `chatbot` (slug) защищена по конвенции — не удалять, база знаний чат-бота всегда должна в неё писать; определяется по `HelpFolder.slug === 'chatbot'`, не хранится отдельным флагом
- `triggerReembed()` требует обеих env-переменных — без них возвращает ошибку без обращения к агенту
