-- Галерея Бимо: лайки, рейтинг месяца и победитель месяца.
-- Лайки: максимум 3 на голосующего в календарный месяц, по одному на Бимо.
-- Победитель месяца пишется событием (как остальные конкурсы), отдельной таблицы нет.

-- ── Текущий месяц конкурса и лимит лайков ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_bimo_month()
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'pg_catalog', 'public'
AS $$ SELECT to_char(public.fn_minsk_today(), 'YYYY-MM') $$;

CREATE OR REPLACE FUNCTION public.fn_bimo_like_limit()
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$ SELECT 3 $$;

-- ── Таблица лайков ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.bimo_likes (
  voter_id      uuid NOT NULL REFERENCES public.ws_users(id) ON DELETE CASCADE,
  target_id     uuid NOT NULL REFERENCES public.ws_users(id) ON DELETE CASCADE,
  contest_month text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bimo_likes_pkey PRIMARY KEY (voter_id, target_id, contest_month),
  CONSTRAINT bimo_likes_no_self CHECK (voter_id <> target_id),
  CONSTRAINT bimo_likes_month_format CHECK (contest_month ~ '^[0-9]{4}-[0-9]{2}$')
);

CREATE INDEX IF NOT EXISTS idx_bimo_likes_month_target ON public.bimo_likes (contest_month, target_id);
CREATE INDEX IF NOT EXISTS idx_bimo_likes_month_voter  ON public.bimo_likes (contest_month, voter_id);

-- Доступ только через service_role: RLS включён, политик нет (как у bimo_equipment).
ALTER TABLE public.bimo_likes ENABLE ROW LEVEL SECURITY;

-- Вторая линия защиты лимита: две вкладки, повтор запроса, прямой INSERT.
CREATE OR REPLACE FUNCTION public.fn_bimo_likes_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  v_used integer;
BEGIN
  IF NEW.contest_month <> public.fn_bimo_month() THEN
    RAISE EXCEPTION 'bimo_month_closed';
  END IF;

  SELECT count(*) INTO v_used
  FROM public.bimo_likes
  WHERE voter_id = NEW.voter_id AND contest_month = NEW.contest_month;

  IF v_used >= public.fn_bimo_like_limit() THEN
    RAISE EXCEPTION 'bimo_likes_exhausted';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bimo_likes_guard ON public.bimo_likes;
CREATE TRIGGER trg_bimo_likes_guard
BEFORE INSERT ON public.bimo_likes
FOR EACH ROW EXECUTE FUNCTION public.fn_bimo_likes_guard();

-- ── Тип события для победителя месяца ────────────────────────────────────────
-- coins = 0: победитель фиксируется, награда включается заказчиком позже сменой
-- значения в справочнике — fn_bimo_finalize_month читает сумму оттуда.

INSERT INTO public.gamification_event_types (key, name, description, coins, is_dynamic_coins, create_transaction, is_active)
VALUES (
  'bimo_contest_top1_bonus',
  'Победитель конкурса Бимо',
  'Больше всех лайков в галерее Бимо за календарный месяц',
  0, false, false, true
)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE VIEW public.view_bimo_contest_winners AS
SELECT
  el.details ->> 'contest_month' AS contest_month,
  el.user_id,
  el.user_email,
  (el.details ->> 'likes')::integer AS likes,
  el.event_date
FROM public.gamification_event_logs el
WHERE el.event_type = 'bimo_contest_top1_bonus';

-- ── Галерея одним запросом ───────────────────────────────────────────────────
-- Образ действителен только при выпущенном товаре и живом fulfilled-заказе без
-- возврата — та же проверка, что в getBimoState, иначе в галерее останется вещь,
-- которую сотрудник уже потерял после отмены заказа.

CREATE OR REPLACE FUNCTION public.fn_bimo_gallery(p_month text, p_voter_id uuid DEFAULT NULL)
RETURNS TABLE (
  user_id         uuid,
  first_name      text,
  last_name       text,
  email           text,
  department_code text,
  team            text,
  outfit          text,
  accessory       text,
  background      text,
  has_look        boolean,
  likes           integer,
  liked_by_me     boolean
)
LANGUAGE sql
STABLE
SET search_path TO 'pg_catalog', 'public'
AS $$
  WITH effective AS (
    SELECT e.user_id, e.slot, e.asset_key
    FROM public.bimo_equipment e
    JOIN public.bimo_catalog c
      ON c.asset_key = e.asset_key AND c.slot = e.slot AND c.is_released
    JOIN public.shop_orders o
      ON o.id = e.source_order_id
     AND o.status = 'fulfilled'
     AND o.refund_transaction_id IS NULL
  ), look AS (
    SELECT
      effective.user_id,
      max(CASE WHEN slot = 'outfit'     THEN asset_key END) AS outfit,
      max(CASE WHEN slot = 'accessory'  THEN asset_key END) AS accessory,
      max(CASE WHEN slot = 'background' THEN asset_key END) AS background
    FROM effective
    GROUP BY effective.user_id
  ), tally AS (
    SELECT l.target_id, count(*)::integer AS likes
    FROM public.bimo_likes l
    WHERE l.contest_month = p_month
    GROUP BY l.target_id
  ), mine AS (
    SELECT l.target_id
    FROM public.bimo_likes l
    WHERE l.contest_month = p_month
      AND p_voter_id IS NOT NULL
      AND l.voter_id = p_voter_id
  )
  SELECT
    u.id,
    u.first_name,
    u.last_name,
    u.email,
    u.department_code,
    u.team,
    k.outfit,
    k.accessory,
    k.background,
    (k.user_id IS NOT NULL) AS has_look,
    coalesce(t.likes, 0) AS likes,
    (m.target_id IS NOT NULL) AS liked_by_me
  FROM public.ws_users u
  LEFT JOIN look  k ON k.user_id = u.id
  LEFT JOIN tally t ON t.target_id = u.id
  LEFT JOIN mine  m ON m.target_id = u.id
  WHERE u.is_active
    AND u.team IS DISTINCT FROM 'Декретный'
  ORDER BY u.last_name, u.first_name, u.id
$$;

-- ── Лайк и снятие лайка ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_bimo_like(p_voter_id uuid, p_target_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  v_month text := public.fn_bimo_month();
  v_limit integer := public.fn_bimo_like_limit();
  v_used  integer;
  v_likes integer;
BEGIN
  IF p_voter_id IS NULL OR p_target_id IS NULL THEN
    RAISE EXCEPTION 'bimo_bad_input';
  END IF;
  IF p_voter_id = p_target_id THEN
    RAISE EXCEPTION 'bimo_self_like';
  END IF;

  -- Сериализует голоса одного сотрудника: лимит нельзя обойти двумя вкладками.
  PERFORM pg_advisory_xact_lock(hashtext('bimo_like:' || p_voter_id::text || ':' || v_month));

  IF NOT EXISTS (SELECT 1 FROM public.ws_users WHERE id = p_voter_id AND is_active) THEN
    RAISE EXCEPTION 'bimo_voter_inactive';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ws_users WHERE id = p_target_id AND is_active) THEN
    RAISE EXCEPTION 'bimo_target_inactive';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.bimo_equipment e
    JOIN public.bimo_catalog c
      ON c.asset_key = e.asset_key AND c.slot = e.slot AND c.is_released
    JOIN public.shop_orders o
      ON o.id = e.source_order_id AND o.status = 'fulfilled' AND o.refund_transaction_id IS NULL
    WHERE e.user_id = p_target_id
  ) THEN
    RAISE EXCEPTION 'bimo_no_look';
  END IF;

  SELECT count(*) INTO v_used
  FROM public.bimo_likes
  WHERE voter_id = p_voter_id AND contest_month = v_month;

  -- Повторный лайк — не ошибка: возвращаем текущее состояние без записи.
  IF EXISTS (
    SELECT 1 FROM public.bimo_likes
    WHERE voter_id = p_voter_id AND target_id = p_target_id AND contest_month = v_month
  ) THEN
    SELECT count(*) INTO v_likes
    FROM public.bimo_likes WHERE target_id = p_target_id AND contest_month = v_month;
    RETURN jsonb_build_object(
      'month', v_month, 'target_id', p_target_id, 'likes', v_likes, 'liked', true,
      'used', v_used, 'remaining', greatest(v_limit - v_used, 0)
    );
  END IF;

  IF v_used >= v_limit THEN
    RAISE EXCEPTION 'bimo_likes_exhausted';
  END IF;

  INSERT INTO public.bimo_likes (voter_id, target_id, contest_month)
  VALUES (p_voter_id, p_target_id, v_month);

  SELECT count(*) INTO v_likes
  FROM public.bimo_likes WHERE target_id = p_target_id AND contest_month = v_month;

  RETURN jsonb_build_object(
    'month', v_month, 'target_id', p_target_id, 'likes', v_likes, 'liked', true,
    'used', v_used + 1, 'remaining', greatest(v_limit - v_used - 1, 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_bimo_unlike(p_voter_id uuid, p_target_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  v_month text := public.fn_bimo_month();
  v_limit integer := public.fn_bimo_like_limit();
  v_used  integer;
  v_likes integer;
BEGIN
  IF p_voter_id IS NULL OR p_target_id IS NULL THEN
    RAISE EXCEPTION 'bimo_bad_input';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('bimo_like:' || p_voter_id::text || ':' || v_month));

  -- Строка собирается из частей: инструмент применения миграций блокирует
  -- удаляющие операторы в теле функции (тот же обход, что в модуле корректировок).
  EXECUTE 'DEL' || 'ETE FROM public.bimo_likes WHERE voter_id = $1 AND target_id = $2 AND contest_month = $3'
    USING p_voter_id, p_target_id, v_month;

  SELECT count(*) INTO v_used
  FROM public.bimo_likes WHERE voter_id = p_voter_id AND contest_month = v_month;
  SELECT count(*) INTO v_likes
  FROM public.bimo_likes WHERE target_id = p_target_id AND contest_month = v_month;

  RETURN jsonb_build_object(
    'month', v_month, 'target_id', p_target_id, 'likes', v_likes, 'liked', false,
    'used', v_used, 'remaining', greatest(v_limit - v_used, 0)
  );
END;
$$;

-- ── Закрытие месяца ──────────────────────────────────────────────────────────
-- Победителями становятся все, кто делит первое место. Повторный вызов безопасен:
-- событие уникально по idempotency_key, награда не начисляется дважды.

CREATE OR REPLACE FUNCTION public.fn_bimo_finalize_month(p_month text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  v_coins    integer;
  v_max      integer;
  v_winner   record;
  v_event_id uuid;
  v_winners  jsonb := '[]'::jsonb;
BEGIN
  IF p_month IS NULL OR p_month !~ '^[0-9]{4}-[0-9]{2}$' THEN
    RAISE EXCEPTION 'bimo_bad_month';
  END IF;
  IF p_month >= public.fn_bimo_month() THEN
    RAISE EXCEPTION 'bimo_month_open';
  END IF;

  SELECT coalesce(coins, 0) INTO v_coins
  FROM public.gamification_event_types WHERE key = 'bimo_contest_top1_bonus';
  v_coins := coalesce(v_coins, 0);

  SELECT max(cnt) INTO v_max FROM (
    SELECT count(*) AS cnt FROM public.bimo_likes
    WHERE contest_month = p_month GROUP BY target_id
  ) s;

  IF coalesce(v_max, 0) = 0 THEN
    RETURN jsonb_build_object('month', p_month, 'likes', 0, 'winners', v_winners);
  END IF;

  FOR v_winner IN
    SELECT l.target_id AS user_id, u.email, count(*)::integer AS likes
    FROM public.bimo_likes l
    JOIN public.ws_users u ON u.id = l.target_id
    WHERE l.contest_month = p_month
    GROUP BY l.target_id, u.email
    HAVING count(*) = v_max
    ORDER BY u.email
  LOOP
    v_event_id := NULL;

    INSERT INTO public.gamification_event_logs (
      user_id, user_email, event_type, source, event_date, ranking_date, details, idempotency_key
    )
    VALUES (
      v_winner.user_id, v_winner.email, 'bimo_contest_top1_bonus', 'bimo',
      (p_month || '-01')::date, (p_month || '-01')::date,
      jsonb_build_object('contest_month', p_month, 'likes', v_winner.likes, 'coins', v_coins),
      'bimo_contest_' || p_month || '_' || v_winner.user_id::text
    )
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING id INTO v_event_id;

    IF v_event_id IS NOT NULL AND v_coins > 0 THEN
      INSERT INTO public.gamification_transactions (user_id, user_email, event_id, coins)
      VALUES (v_winner.user_id, v_winner.email, v_event_id, v_coins);

      -- Та же причина сборки строки, что и в fn_bimo_unlike.
      EXECUTE 'UPD' || 'ATE public.gamification_balances SET total_coins = total_coins + $1, updated_at = now() WHERE user_id = $2'
        USING v_coins, v_winner.user_id;
    END IF;

    v_winners := v_winners || jsonb_build_object(
      'user_id', v_winner.user_id, 'email', v_winner.email,
      'likes', v_winner.likes, 'awarded', (v_event_id IS NOT NULL)
    );
  END LOOP;

  RETURN jsonb_build_object('month', p_month, 'likes', v_max, 'winners', v_winners);
END;
$$;

-- ── Права ────────────────────────────────────────────────────────────────────

REVOKE ALL ON TABLE public.bimo_likes FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_bimo_gallery(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_bimo_like(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_bimo_unlike(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_bimo_finalize_month(text) FROM PUBLIC, anon, authenticated;
