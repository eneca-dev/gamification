-- Тип события: сброс стрика из-за неверного статуса задачи
INSERT INTO gamification_event_types (key, name, coins, is_dynamic_coins, is_active)
VALUES ('streak_reset_wrong_status', 'Стрик сброшен: время в неверном статусе', 0, false, true)
ON CONFLICT (key) DO NOTHING;
