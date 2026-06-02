# Чанки определений: хранение и управление в админке

## Цель

Содержимое `definitions.md` хранится в `help_articles` как отдельная группа статей.
Администраторы редактируют их через стандартный `HelpEditor`.
RAG-агент использует чанки из всех опубликованных статей — и справки, и определений.
Пользователи видят в разделе «Справка» только статьи с `show_in_help = true`.

---

## Фаза 1 — Схема БД

### 1.1 Добавить колонку `show_in_help`

```sql
ALTER TABLE help_articles
  ADD COLUMN show_in_help BOOLEAN NOT NULL DEFAULT true;
```

`show_in_help = false` — статья участвует в RAG (чанкуется), но не отображается в пользовательской справке.

---

## Фаза 2 — Данные: definitions.md → help_articles

Содержимое `definitions.md` заносится как статьи с флагами:

```
is_published   = true
show_in_help   = false
folder         = 'chatbot'
folder_label   = 'Чат-бот: определения'
```

Примерное деление на статьи:

| slug | title |
|---|---|
| `chatbot-currency` | Кристаллы, зелёный день, красный день |
| `chatbot-streaks` | Стрики WS и Revit, вторая жизнь |
| `chatbot-worksection` | Тайм-трекинг, метка прогресса, бюджет, штраф за статус |
| `chatbot-revit-plugins` | Revit-плагины, InstallationManager |
| `chatbot-gratitudes` | Благодарности, квота, категории, достижения |
| `chatbot-ratings` | Личный, командный, рейтинг отделов, коэффициент вовлечённости |
| `chatbot-shop` | Магазин, eneca-game, период достижений |

Конкретное разбиение можно уточнять — начать с одной статьи и дробить по мере необходимости.

---

## Фаза 3 — Фильтр в справке

В `getHelpArticles()` и `getHelpFolders()` добавить фильтр:

```ts
.eq('show_in_help', true)
```

Статьи с `show_in_help = false` исчезают из пользовательской справки, но продолжают чанковаться и участвовать в RAG.

---

## Фаза 4 — Тоггл в HelpEditor

В `HelpEditor` добавить тоггл «Показывать в справке» рядом с существующим «Опубликовано».

- Для новых статей в папке `chatbot` — по умолчанию выключен
- Для всех остальных статей — по умолчанию включён
- Оба значения сохраняются через существующий `updateHelpArticle`

---

## Фаза 5 — Страница `/admin/chatbot`

### Маршрут
```
src/app/(main)/admin/chatbot/
  page.tsx       — список chatbot-статей + их чанки
  loading.tsx    — скелетон
```

### Поведение страницы

- Показывает все статьи с `show_in_help = false`, сгруппированные по `folder_label`
- Для каждой статьи — список чанков из `help_article_chunks` (текст, `chunk_index`)
- Кнопка «Редактировать» открывает `/admin/help/[slug]/edit` — существующий `HelpEditor` без изменений
- Статус `is_published` виден на карточке (неопубликованная статья → чанков нет)

### Что НЕ делаем
- Прямого редактирования чанков нет — они генерируются скриптом из статьи

---

## Фаза 6 — Перезапуск векторизации из админки

После сохранения любой статьи в `HelpEditor` показывать баннер с кнопкой:

> «Статья обновлена. Перезапустите векторизацию, чтобы чат-бот узнал об изменениях.»  
> [Обновить чанки]

### Кнопка «Обновить чанки»

- Server Action вызывает POST-эндпоинт FastAPI-агента: `POST /reembed`
- Агент запускает `embed_help_articles.py` как фоновую задачу (BackgroundTasks) и сразу возвращает `202 Accepted`
- Пока задача выполняется — кнопка показывает спиннер
- По завершении (через Supabase Realtime или polling) — баннер меняется на «Чанки обновлены»

### Эндпоинт `/reembed` на агенте (FastAPI)

```python
@app.post("/reembed")
async def reembed(
    background_tasks: BackgroundTasks,
    x_secret_key: str = Header(...)
):
    if x_secret_key != settings.WEBHOOK_SECRET:
        raise HTTPException(401)
    background_tasks.add_task(run_embed_script)
    return {"status": "accepted"}
```

Защита — тот же `x-secret-key`, что и у вебхука чата.

### Статус векторизации

Для отображения результата в UI добавить таблицу `chatbot_reembed_log`:

```sql
CREATE TABLE chatbot_reembed_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at  TIMESTAMPTZ DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status      TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'done', 'error')),
  error       TEXT
);
```

Агент пишет запись при старте и обновляет при завершении.
`HelpEditor` подписывается на последнюю запись через Supabase Realtime и показывает актуальный статус.

---

## Фаза 7 — Реализация `/reembed` на агенте

### Проблема
`embed_help_articles.py` лежит вне Docker-контейнера `chat-agent`. В контейнере доступен только `chat_agent/`.

### Решение
Вынести логику эмбеддинга в `chat_agent/reembed.py` — функция `run_reembed()`.  
`embed_help_articles.py` в корне становится тонкой обёрткой, вызывающей ту же функцию (для ручного запуска).  
FastAPI-эндпоинт запускает `run_reembed()` как BackgroundTask.

Агент также пишет в `chatbot_reembed_log` при старте и завершении задачи.

### Nginx
Добавить `location /reembed` в блок `sync-zorina.eneca.work`:
```nginx
location /reembed {
    proxy_pass http://172.17.0.1:8001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

### `.env.local` (Next.js)
```
CHAT_AGENT_URL=https://sync-zorina.eneca.work
CHAT_AGENT_SECRET=<то же значение, что WEBHOOK_SECRET в .env на VPS>
```

---

## Порядок выполнения

```
[x] 1   Миграция: ADD COLUMN show_in_help
[x] 2   Миграция: CREATE TABLE chatbot_reembed_log
[x] 3   Обновить getHelpArticles / getHelpFolders: фильтр show_in_help = true
[x] 4   Добавить тоггл show_in_help в HelpEditor + updateHelpArticle
[x] 5   Добавить баннер + кнопку «Обновить чанки» в HelpEditor (Server Action → POST /reembed)
[x] 6   Создать /admin/chatbot: page.tsx + loading.tsx
[x] 7   Реализовать /reembed на агенте: chat_agent/reembed.py + main.py + nginx.conf
[x] 8   Добавить CHAT_AGENT_URL + CHAT_AGENT_SECRET в .env.local
[ ] 9   Наполнить help_articles данными из definitions.md (через админку)
[ ] 10  Запустить embed_help_articles.py вручную, проверить чанки
```
