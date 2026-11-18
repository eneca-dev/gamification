# Рабочая БД: SQL01 установлен, SQL02 приостановлен

18.11.2026. Актуальные машинные результаты: working-db-current-results.json.

## Что выполнено

- Побайтно подтверждено: SQL01/02 submission отличаются от review только удалением BOM.
- Предварительный SELECT исправлен: справочник gamification_event_types использует key. Проверены 177 колонок, 84 ограничения, триггеры и восемь функций.
- Свежие определения/права сохранены в test-results/roulette-working-db/20261118-approved-retry. SQL05 содержит именно исходные четыре отчёта.
- SQL01 применён успешно: migration 20261118120600 roulette_atomic_spins_disabled_v2.
- Шесть функций совпадают с локальными по MD5; anon/authenticated не имеют EXECUTE, service_role имеет; SECURITY INVOKER сохранён.
- roulette_settings.enabled=false; одна строка, RLS включён. Событий рулетки нет, статистика нулевая. Настоящих ходов и тестовых изменений баланса не было.
- Все четыре отчёта выполняются в read-only транзакции под service_role, outputs/MD5/owner/ACL/proconfig/security совпадают с исходными.
- SQL02, SQL05 и SQL06 не применялись.

## Причина остановки

Hosted DEFAULT PRIVILEGES для новых public-таблиц дают service_role ALL. SQL01 снимает права у PUBLIC/anon/authenticated, но не сбрасывает прежние default grants service_role перед GRANT SELECT,UPDATE. Поэтому:

| Объект | Проверено локально | Получено в working DB |
| --- | --- | --- |
| public.roulette_settings, service_role | SELECT, UPDATE | INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN |

Прежний preflight не сравнивал DEFAULT PRIVILEGES: это пробел проверки. Пользовательский доступ закрыт, но фактический ACL шире проверенного контракта. По условию пользователя дальнейшая запись остановлена. Исходные SQL01/02 не изменены.

## Предлагаемая коррекция — требует согласования

Точный файл: sql/06-settings-acl.review.sql. Существенные операторы:

```sql
revoke all on table public.roulette_settings from service_role;
grant select, update on table public.roulette_settings to service_role;
```

Файл включает транзакцию, короткие timeout, SHARE lock настройки, guard ровно одной выключенной строки и проверку отсутствия лишних прав, включая MAINTAIN. Нет DML, изменения DEFAULT PRIVILEGES или определений функций.

Проверено в изолированном PG: широкие права воспроизведены, тело коррекции оставило SELECT/UPDATE, затем эксперимент откатан и исходный локальный ACL восстановлен. Доказательство: settings-acl-local-results.json. Это rollback-тест, а не применение в working DB.

Рекомендуется после согласования применить SQL06, проверить ACL/выключатель/ноль событий и продолжить прежний точный SQL02 без BOM со свежей проверкой исходных четырёх функций. SQL01 повторно не отправлять.

Альтернатива — оставить установленный SQL01 выключенным и отложить SQL02; немедленных финансовых изменений нет, но приёмка прав не завершена. Откатывать/удалять объекты SQL01 не требуется. SQL05 остаётся пакетом восстановления отчётов, если впоследствии будет применён SQL02.

Supabase advisor добавил INFO [RLS enabled no policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) для settings. Это соответствует модели service-only с закрытыми anon/authenticated; политику клиентского доступа добавлять не предлагается.
