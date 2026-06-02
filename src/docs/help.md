# help

Справочный раздел для пользователей и база знаний чат-бота. Статьи хранятся в Supabase, рендерятся как markdown, доступны для редактирования через админку.

## Логика работы

Статьи хранятся в таблице `help_articles` с markdown-контентом. Группируются по папкам (folder). На клиенте рендерятся через react-markdown + remark-gfm. Поиск — простой `includes()` фильтр по title и content.

Флаг `show_in_help` разделяет назначение статей:
- `show_in_help = true` — статья видна пользователям в `/help`
- `show_in_help = false` — статья скрыта от пользователей, но чанкуется и участвует в RAG чат-бота (папка `chatbot`)

Кэширование: страницы кэшируются Next.js (server components). После редактирования в админке вызывается `revalidatePath('/help')` для сброса кэша.

После редактирования любой статьи в `HelpEditor` отображается баннер с кнопкой «Обновить чанки» — она вызывает `triggerReembed()`, который POST-запросом запускает перевекторизацию на FastAPI-агенте.

## Зависимости

- Таблицы: `help_articles`, `help_article_chunks`, `chatbot_reembed_log`
- npm: `react-markdown`, `remark-gfm`
- CSS: `.help-content` стили в `globals.css`
- Внешний сервис: FastAPI chat-agent (env: `CHAT_AGENT_URL`, `CHAT_AGENT_SECRET`)

## Типы

- `HelpArticle` — полная строка из таблицы (id, slug, folder, folder_label, title, content, sort_order, is_published, show_in_help, updated_at)
- `HelpFolder` — группировка: folder, folder_label, articles[]
- `HelpChunk` — чанк статьи: id, article_id, slug, chunk_index, content, created_at
- `ReembedLog` — запись лога векторизации: id, started_at, finished_at, status, error

## Actions

- `updateHelpArticle(input)` — обновление статьи. Revalidate: `/help`, `/admin/help`
- `createHelpArticle(input)` — создание новой статьи. Revalidate: `/help`, `/admin/help`
- `deleteHelpArticle(slug)` — удаление статьи. Revalidate: `/help`, `/admin/help`
- `triggerReembed()` — POST к FastAPI-агенту `/reembed`. Требует `CHAT_AGENT_URL` и `CHAT_AGENT_SECRET` в env. Возвращает `{ success: true }` или `{ success: false, error }`.

## Queries

- `getHelpArticles()` — опубликованные статьи с `show_in_help = true` для пользовательской справки
- `getHelpArticle(slug)` — одна опубликованная статья по slug
- `getHelpFolders()` — сгруппированные по папкам для навигации (только show_in_help = true)
- `getAllHelpArticles()` — все статьи включая неопубликованные (для админки)
- `getChatbotArticlesWithChunks()` — статьи с `show_in_help = false` и их чанки (для `/admin/chatbot`)
- `getLastReembedLog()` — последняя запись из `chatbot_reembed_log`

## Ограничения

- slug уникален (UNIQUE constraint)
- RLS: чтение для всех, запись только для admin (ws_users.is_admin)
- Папки (folder) не хранятся отдельно — текстовые поля на статье
- `triggerReembed()` требует обеих env-переменных — без них возвращает ошибку без обращения к агенту
