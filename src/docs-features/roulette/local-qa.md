# Локальная SQL-приёмка — 18.11.2026

Платный Supabase не создавался. В рабочую БД SQL не применялся. По разрешению пользователя создан **отдельный локальный кластер PostgreSQL 18.7**, не использующий данные работающей Windows-службы.

## Изоляция и состав

- Бинарники: D:/PostgreSQL/bin. Кластер: test-results/local-postgres/data, только 127.0.0.1:55437, БД roulette_qa, отдельный roulette_local_admin.
- Случайный пароль и данные находятся в игнорируемой test-results; пароль не выводится и не попадает в Git.
- pg_ctl не смог создать restricted token в sandbox. Прямой запуск postgres.exe с WindowStyle Hidden сработал; адрес/порт/data_directory проверены SQL-запросом.
- Docker не используется. Существующая служба postgresql-x64-18 и её база не менялись.
- Baseline: tests/integration/fixtures/local-baseline.sql. Взяты read-only метаданные 22 прикладных таблиц с колонками, DEFAULT, NOT NULL, PK/UNIQUE/CHECK/FK. Данных сотрудников/событий нет.
- Сохранены реальные определения purchase_product(uuid,uuid,text), девятиаргументного process_gamification_event, current_crystal_rate, adoption_designer_cohort_v2, BYN/date triggers и guard_streak_shield_order_cancel.
- Не перенесены фоновые trg_award_revit_points, trg_award_gratitude_points_v2, trg_link_ws_user_on_profile_insert, cron, Edge Functions, Vault, HTTP/FDW/интеграции. Единственные extensions — plpgsql и pgcrypto.
- auth.users представлен ID-only fixture для FK. Supabase Auth/JWT hooks, PostgREST, Storage и прикладные RLS policies не эмулируются. RLS флаги и ограничение новых roulette RPC проверены отдельно; это не полная проверка всех существующих политик.
- Четыре исходных reporting pg_get_functiondef совпали по MD5 с рабочими метаданными даже на PG18. Их хеши не подменялись для обхода drift guard.

## Реально пройдено

1. 15 Vitest integration tests: 13 roulette/races/permissions/limits и 2 reporting-сценария.
2. Семь исходов при B=1000: 2000/1500/1200/1100/1050/0/0; одна delta-проводка, один event, BYN по курсу 80.
3. Повтор с другим UUID, выключением и переходом месяца возвращает канонический результат, не подменяет текущий баланс историческим.
4. Два реальных соединения: два хода, покупка и начисление в обоих порядках; ожидание блокировки подтверждено pg_stat_activity.
5. Ошибка после event/transaction/balance откатывает все финансовые изменения. Проверены смена месяца после lock, выключение после разрешающей проверки, нулевой баланс и числовой предел до RNG.
6. anon/authenticated не могут вызывать roulette RPC или менять выключатель.
7. SQL 02 проверен в транзакции до/после на синтетических данных: earned 1200→400, earned_logged 730→130, earners 3→2; spent=235, balance_at_to=965; остальные JSON-поля отчётов неизменны. Top B=270/A=130. Join даёт 12 строк и сумму 965; TypeScript earned/spent совпадают с SQL.
8. NULL-source — отдельный явно отмеченный edge test: NOT NULL ослаблен только внутри локальной откатываемой транзакции. Production schema и её правило не изменены.
9. После удаления QA overrides проверены настоящие RNG/часы: 70000 выборок, chi-square 6.49 при df=6 и пороге 50. Это статистическая проверка плюс проверка rejection sampling в коде, не математическое доказательство случайности.

Машинный отчёт и точные SQL SHA-256: [local-db-results.json](local-db-results.json). Полный Vitest JSON: test-results/local-postgres/integration-results.json (игнорируемый локальный артефакт).

## Повторение

- На уже подготовленной локальной базе: `node scripts/roulette-local-qa.mjs`.
- Для нового пустого **собственного** кластера с тем же адресом/портом/каталогом и password.txt: `node scripts/prepare-roulette-local.mjs`, затем runner. Подготовщик намеренно откажет, если roulette_qa уже существует; автоматически ничего не удаляет.
- Скрипты не читают DATABASE_URL и не имеют fallback на рабочую БД. Connect проверяет loopback/порт/имя/пользователя/data_directory; тесты дополнительно проверяют marker и разрешённые flags.
- Runner повторно ставит controls только локально, выполняет integration/seven-outcomes, удаляет controls, проверяет реальный RNG. При ошибке он не пишет новый passed-отчёт; при прежнем отчёте проверить дату/вывод последнего запуска.
- Успешное конечное состояние: roulette_qa.control отсутствует, рулетка выключена. Временный локальный сервер пока оставлен для продолжения проверки.
- Подготовщик добавлен для воспроизводимости; полный путь создания уже выполнен командами отдельно. Повторное создание поверх существующей базы не запускалось.

## Оставшиеся ограничения

Это PostgreSQL 18.7, а рабочий Supabase — PostgreSQL 17. Не проверены hosted Auth/PostgREST, server-cache поведение в живом браузере, реальные интеграции, все рейтинги и полная матрица экранов. Допустимые performance-регрессии ещё не согласованы; эти прогоны не выдаются за before/after benchmark.

Ограничение pilot account реализовано отдельно в src/config/roulette.ts и server actions. Без ROULETTE_PILOT_EMAIL новые ходы запрещены; recovery своего старого результата работает. Email пользователя ещё не задан. Включение/публикация и применение точного SQL в рабочей БД требуют отдельных разрешений.

