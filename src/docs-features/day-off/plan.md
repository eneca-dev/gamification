# Фича: Взять выходной

## Цель

Сотрудник подаёт заявку на геймификационный выходной. Одобрение вручную или автоматически (с реалистичной задержкой). После одобрения — INSERT в ws_user_absences → стрик замораживается, грид синий.

## Интеграция с системой стриков

- Одобрение → INSERT `ws_user_absences` (absence_type='day_off')
- VPS compute-gamification при обработке даты → status='absent' в ws_daily_statuses
- Грид: синий квадрат (frozen = var(--apex-info-text))
- Стрик: дельта 0 (не растёт, не падает)

## Этапы реализации

### Этап 1 — Миграция БД (060)
- ALTER ws_user_absences: добавить 'day_off' в CHECK constraint
- CREATE TABLE day_off_requests
- RLS политики
- Storage bucket 'day-off-screenshots'
- fn_process_day_off_requests() — авто-обработка pg_cron
- pg_cron расписание каждые 2 минуты

### Этап 2 — Модуль src/modules/day-off/
- types.ts, queries.ts, actions.ts, index.ts, index.client.ts

### Этап 3 — Страница /day-off
- DayOffInstructions, DayOffForm, DayOffRequestList, DayOffStatusBadge

### Этап 4 — Страница /admin/day-off
- AdminDayOffList с кнопками апрув/реджект

### Этап 5 — Навигация
- Sidebar + AdminNav

### Этап 6 — StreakPanel
- absenceLabels: 'day_off' → 'Геймификация'

## Критерии готовности
- [ ] Сотрудник подаёт заявку, прикладывает скрин
- [ ] Статус меняется: pending → reviewed → approved
- [ ] После одобрения — запись в ws_user_absences
- [ ] Грид синий, стрик заморожен
- [ ] Один активный запрос одновременно
- [ ] Консоль не раскрывает авто-одобрение
- [ ] npm run build проходит