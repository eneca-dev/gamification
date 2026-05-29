# Чат-бот: справочный ассистент

Бот отвечает на вопросы пользователей о системе геймификации.
Тип вопросов: «Как работает X?» и «Почему у меня X?» (на первом этапе — только правила, без персональных данных).

---

## Архитектура

```
Пользователь
  → [Next.js] Server Action → INSERT chat_messages (role: user)
  → [Supabase] Database Webhook (INSERT trigger)
  → [Python / VPS] FastAPI агент
      → embed вопрос → similarity search в help_article_chunks
      → Claude API (или GPT-4o-mini) + RAG-контекст + история
      → INSERT chat_messages (role: assistant)
  → [Supabase Realtime] → клиент получает ответ
```

**Ключевые решения:**
- Нет polling — только Supabase Realtime на клиенте
- Агент отвечает вебхуку `202 Accepted` сразу, обрабатывает в фоне (FastAPI BackgroundTasks)
- Одна непрерывная сессия на пользователя (MVP — без сессий)
- Embeddings: OpenAI `text-embedding-3-small` (1536 dims)
- LLM: `gpt-4o-mini` (или Claude Sonnet — решить до старта)
- Одна сессия на юзера, история обрезается до последних 10 сообщений

---

## Фаза 1 — База данных

### 1.1 Включить pgvector
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 1.2 Таблица `chat_messages`
```sql
CREATE TABLE chat_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own messages" ON chat_messages
  FOR ALL USING (auth.uid() = user_id);
```

### 1.3 Таблица `help_article_chunks`
```sql
CREATE TABLE help_article_chunks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id  UUID REFERENCES help_articles(id) ON DELETE CASCADE,
  slug        TEXT NOT NULL,
  chunk_index INT NOT NULL,
  content     TEXT NOT NULL,   -- текст с раскрытыми {{плейсхолдерами}}
  embedding   vector(1536),
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (article_id, chunk_index)
);

CREATE INDEX ON help_article_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);
```

### 1.4 RPC для similarity search
```sql
CREATE OR REPLACE FUNCTION match_help_chunks(
  query_embedding vector(1536),
  match_count     INT DEFAULT 5
)
RETURNS TABLE (slug TEXT, content TEXT, similarity FLOAT)
LANGUAGE SQL STABLE AS $$
  SELECT slug, content, 1 - (embedding <=> query_embedding) AS similarity
  FROM help_article_chunks
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
```

---

## Фаза 2 — Chat UI в приложении

### Структура модуля
```
src/modules/chat/
  actions.ts           — sendMessage(content: string)
  queries.ts           — getMessages(): ChatMessage[]
  types.ts             — ChatMessage
  components/
    ChatWindow.tsx     — 'use client', Realtime подписка, список сообщений
    ChatInput.tsx      — 'use client', инпут + отправка
    ChatBubble.tsx     — один пузырёк (user / assistant)
  index.client.ts
src/app/chat/
  page.tsx             — Server Component, загружает initial messages
  loading.tsx          — скелетон
```

### Server Action `sendMessage`
- Получает контент
- `getCurrentUser()` → берёт `user_id`
- INSERT в `chat_messages` с `role: 'user'`
- Не вызывает `revalidatePath` — Realtime обновит клиент

### `ChatWindow` (Client Component)
- Supabase Realtime: подписка на `chat_messages` с фильтром `user_id=eq.{uid}`
- При получении нового сообщения — добавляет в локальный стейт
- Auto-scroll вниз при новых сообщениях
- Typing indicator: показывать если последнее сообщение от `user` (ответ ещё не пришёл)

---

## Фаза 3 — Скрипт векторизации (Python, одноразовый)

Расположение: `gamification-vps-scripts/embed_help_articles.py`

### Алгоритм
1. Загрузить `gamification_event_types` → словарь `{ key: coins }`
2. Загрузить `ach_gratitude_settings` → `gratitude_threshold`, `gratitude_bonus`
3. Загрузить цены щитов из `shop_products` (поиск по slug/name) → `shield_price_ws`, `shield_price_revit`
4. Загрузить все `help_articles` (is_published = true)
5. Для каждой статьи:
   - Раскрыть `{{key}}` → значение из словарей выше
   - Разбить на чанки по секциям `##` (маленькие статьи < 500 токенов — один чанк)
6. Для каждого чанка: `openai.embeddings.create(model="text-embedding-3-small", input=chunk)`
7. Upsert в `help_article_chunks` по `(article_id, chunk_index)`

### Плейсхолдеры

Большинство — прямое совпадение с `gamification_event_types.key`:

| Плейсхолдер | Источник |
|---|---|
| `{{green_day}}`, `{{ws_streak_7}}` и др. | `gamification_event_types.key → coins` |
| `{{gratitude_threshold}}` | `ach_gratitude_settings.threshold` (= 4) |
| `{{gratitude_bonus}}` | `ach_gratitude_settings.bonus_coins` (= 200) |
| `{{shield_price_ws}}` | `shop_products WHERE name = 'Вторая жизнь: Worksection'` → `ROUND(cost_byn × coefficient × crystal_rate)` |
| `{{shield_price_revit}}` | `shop_products WHERE name = 'Вторая жизнь: Автоматизация'` → `ROUND(cost_byn × coefficient × crystal_rate)` |

> ⚠️ Цены щитов динамичны — зависят от текущего курса кристаллов (`crystal_rates`).
> При изменении курса нужно перезапустить скрипт векторизации, чтобы чанки отражали актуальные цены.

### Зависимости
```
openai
supabase
python-dotenv
```

### Когда перезапускать
Вручную после изменений в `help_articles`. Позже — автоматизировать через webhook при обновлении статьи.

---

## Фаза 4 — Python агент (FastAPI, VPS)

### Структура
```
gamification-vps-scripts/chat_agent/
  main.py          — FastAPI app, webhook endpoint
  rag.py           — similarity search через Supabase RPC
  llm.py           — вызов OpenAI / Claude API
  config.py        — env vars (Supabase URL + service key, OpenAI key, webhook secret)
  requirements.txt
```

### Webhook endpoint
```python
@app.post("/process-message")
async def process_message(
    payload: dict,
    background_tasks: BackgroundTasks,
    x_secret_key: str = Header(...)
):
    if x_secret_key != settings.WEBHOOK_SECRET:
        raise HTTPException(401)
    background_tasks.add_task(handle_message, payload)
    return {"status": "accepted"}  # 202 сразу
```

### Background task `handle_message`
1. Извлечь `user_id`, `content` из webhook payload (`record` поле)
2. Загрузить последние 10 сообщений пользователя из `chat_messages`
3. Embed вопрос: `openai.embeddings.create(model="text-embedding-3-small", input=content)`
4. RAG: вызов `match_help_chunks(query_embedding, match_count=5)`, отфильтровать `similarity < 0.7`
5. Собрать prompt (см. ниже)
6. Вызов LLM API
7. INSERT в `chat_messages`: `{ user_id, role: 'assistant', content: ответ }`

### System prompt
```
Ты ассистент системы геймификации компании.
Отвечаешь только на вопросы о правилах и механике системы.
Используй только информацию из предоставленного контекста.
Если вопрос касается личных данных (транзакций, истории, баланса конкретного пользователя) —
честно сообщи, что пока не имеешь доступа к персональным данным.
Отвечай кратко и по делу. Язык: русский.

Контекст из справки:
{rag_context}
```

---

## Фаза 5 — Supabase Database Webhook

В Supabase Dashboard → Database → Webhooks:

| Параметр | Значение |
|---|---|
| Имя | `chat-to-agent` |
| Table | `chat_messages` |
| Events | INSERT |
| Method | POST |
| URL | `https://<vps-domain>/process-message` |
| HTTP Header | `x-secret-key: <TOKEN>` |

Webhook срабатывает на каждый INSERT — агент сам проверяет `role = 'user'` из payload и игнорирует вставки от ассистента (иначе зацикливание).

---

## Фаза 6 — Деплой агента на VPS

VPS уже использует Docker + `docker-compose.yml` для `gamification-sync`.
`chat-agent` добавляется вторым сервисом в тот же `docker-compose.yml` — тогда один `docker compose up --build` поднимает оба контейнера, и существующий GitHub Actions деплоит оба автоматически.

### Шаг 1 — `chat_agent/Dockerfile`

Создать файл `chat_agent/Dockerfile`:

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
```

> Python 3.11: пакет `supabase>=2.30.0` требует 3.11+ для поддержки ключей формата `sb_secret_*`.

### Шаг 2 — добавить сервис в `docker-compose.yml`

```yaml
services:
  gamification-sync:
    build: .
    container_name: gamification-sync
    restart: unless-stopped
    ports:
      - "3005:3000"
    env_file:
      - .env

  chat-agent:
    build: ./chat_agent
    container_name: chat-agent
    restart: unless-stopped
    ports:
      - "8001:8001"
    env_file:
      - .env
```

Оба сервиса читают один `.env` в корне репозитория.

### Шаг 3 — открыть порт 8001 на сервере

```bash
ufw allow 8001
```

### Шаг 4 — обновить Supabase Webhook URL

После деплоя обновить URL вебхука (Фаза 5) с `http://localhost:8001` на `http://<vps-ip>:8001/process-message`.

### Деплой

GitHub Actions workflow уже есть (`deploy.yml`). После merge в `main` он выполнит `docker compose up -d --build --force-recreate` — оба контейнера пересоберутся и запустятся автоматически.

---

## Порядок выполнения

```
[x] 1.1–1.4   Миграции БД: pgvector, chat_messages, help_article_chunks, RPC
[x] 2         Chat UI: модуль, страница /chat, Server Action, Realtime
[x] 3         Скрипт векторизации: написать, запустить, проверить чанки в БД
[x] 4         Python агент: FastAPI + RAG + история, проверен локально через Postman
[x] 5         Database Webhook: настроить, проверить e2e (UI → агент → ответ в чате)
[x] 6         Деплой: chat_agent/Dockerfile + сервис в docker-compose.yml + nginx proxy /process-message → 8001
```

---

## Открытые вопросы

- [ ] Уточнить `shield_price_ws` и `shield_price_revit` из `shop_products`
- [x] LLM: OpenAI `gpt-4o-mini` + embeddings `text-embedding-3-small` (один ключ)
- [x] VPS: Python 3.10, pip3, Docker. Nginx и pm2 отсутствуют — деплой через Docker
- [ ] Решить кнопку «Начать сначала» (очистить историю чата) — нужна на MVP или нет
