-- Realtime-доставка благодарностей в браузер (подписка postgres_changes на INSERT).
-- 1. У таблицы gratitudes была только service_role политика — realtime не доставляет
--    события пользователям, которых RLS не пускает на SELECT. Лента благодарностей
--    и так видна всем сотрудникам (страница activity), поэтому политика широкая.
-- 2. Таблица добавляется в publication supabase_realtime.

CREATE POLICY "Authenticated can read gratitudes"
  ON public.gratitudes FOR SELECT TO authenticated USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.gratitudes;
