-- Realtime-доставка транзакций в браузер (виджет «Последние операции»).
-- RLS: в отличие от gratitudes, чужие транзакции светить нельзя —
-- политика отдаёт только свои строки через my_ws_user_id().
-- Realtime доставляет подписчику только строки, проходящие его RLS.

CREATE POLICY "Users can read own transactions"
  ON public.gamification_transactions FOR SELECT TO authenticated
  USING (user_id = my_ws_user_id());

ALTER PUBLICATION supabase_realtime ADD TABLE public.gamification_transactions;
