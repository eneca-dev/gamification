# chat

Чат-бот ассистент для ответов на вопросы о правилах геймификации. RAG на основе help_article_chunks + LLM.

## Логика работы

1. Пользователь отправляет сообщение → `sendMessage` INSERT в `chat_messages` (role: user)
2. Supabase Database Webhook → Python FastAPI агент на VPS
3. Агент: embed вопроса → similarity search в `help_article_chunks` → LLM → INSERT (role: assistant)
4. Supabase Realtime → ChatWindow получает оба сообщения через подписку на INSERT

ChatWindow подписывается на `postgres_changes` с фильтром `user_id=eq.{uid}`. Дедупликация по `id`.
`isWaiting` — true после отправки, false при получении сообщения от assistant.

ChatWidget показывает кнопку очистки (Trash2) в шапке, когда в истории есть хотя бы одно сообщение. Клик: оптимистичный сброс `messages = []` → `clearMessages()` на сервере.

## Зависимости

- `chat_messages` — таблица сообщений (pgvector + Realtime enabled)
- `help_article_chunks` — векторизованные чанки статей справки
- Python агент на VPS (chat_agent/) — обрабатывает сообщения через webhook

## Типы

`ChatMessage` — `{ id, user_id, role: 'user'|'assistant', content, created_at }`

## Actions

- `sendMessage({ content })` — INSERT в chat_messages (role: user). Без revalidatePath.
- `clearMessages()` — DELETE всех сообщений текущего пользователя из chat_messages. Без revalidatePath (данные через Realtime).

## Queries

- `getChatMessages()` — последние 50 сообщений текущего пользователя, ASC по created_at

## Ограничения

- Одна сессия на пользователя (нет разбивки на треды)
- Агент читает последние 5 сообщений истории (`HISTORY_LIMIT = 5` в `chat_agent/config.py`)
- Без персональных данных (транзакции, баланс) — только справочная информация
- System prompt явно инструктирует агента о лимите памяти и отсутствии доступа к персональным данным
