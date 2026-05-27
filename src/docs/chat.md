# chat

Чат-бот ассистент для ответов на вопросы о правилах геймификации. RAG на основе help_article_chunks + LLM.

## Логика работы

1. Пользователь отправляет сообщение → `sendMessage` INSERT в `chat_messages` (role: user)
2. Supabase Database Webhook → Python FastAPI агент на VPS
3. Агент: embed вопроса → similarity search в `help_article_chunks` → LLM → INSERT (role: assistant)
4. Supabase Realtime → ChatWindow получает оба сообщения через подписку на INSERT

ChatWindow подписывается на `postgres_changes` с фильтром `user_id=eq.{uid}`. Дедупликация по `id`.
`isWaiting` — true после отправки, false при получении сообщения от assistant.

## Зависимости

- `chat_messages` — таблица сообщений (pgvector + Realtime enabled)
- `help_article_chunks` — векторизованные чанки статей справки
- Python агент на VPS (chat_agent/) — обрабатывает сообщения через webhook

## Типы

`ChatMessage` — `{ id, user_id, role: 'user'|'assistant', content, created_at }`

## Actions

- `sendMessage({ content })` — INSERT в chat_messages (role: user). Без revalidatePath.

## Queries

- `getChatMessages()` — последние 50 сообщений текущего пользователя, ASC по created_at

## Ограничения

- Одна сессия на пользователя (нет разбивки на треды)
- Агент читает последние 10 сообщений истории
- Без персональных данных (транзакции, баланс) — только справочная информация
