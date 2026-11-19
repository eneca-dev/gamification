-- LOCAL TEST BASELINE ONLY. Schema metadata, no production data.
-- Auth service is not reproduced; auth.users is an ID-only FK fixture.
create schema auth;
create table auth.users(id uuid primary key);
create schema extensions;
create extension pgcrypto with schema extensions;
-- Roles belong to the isolated cluster, not an individual fixture database.
do $roles$
declare role_name text; r record;
begin
  foreach role_name in array array['anon','authenticated','service_role'] loop
    select * into r from pg_roles where rolname=role_name;
    if found then
      if r.rolcanlogin or r.rolsuper or r.rolcreatedb or r.rolcreaterole or r.rolreplication
        or r.rolbypassrls is distinct from (role_name='service_role')
        or exists(select 1 from pg_auth_members where roleid=r.oid or member=r.oid)
      then raise exception 'Unexpected existing fixture role: %',role_name; end if;
    else
      execute format('create role %I nologin %s',role_name,
        case when role_name='service_role' then 'bypassrls' else 'nobypassrls' end);
    end if;
  end loop;
end $roles$;
create sequence public.crystal_rates_id_seq;
create table public."admin_department_groups" (
"department" text not null,
"group_type" text default 'non_designer'::text not null
);
create table public."calendar_holidays" (
"id" bigint generated always as identity not null,
"date" date not null,
"name" text not null,
"created_by" uuid,
"created_at" timestamp with time zone default now() not null
);
create table public."calendar_workdays" (
"id" bigint generated always as identity not null,
"date" date not null,
"name" text not null,
"created_by" uuid,
"created_at" timestamp with time zone default now() not null
);
create table public."crystal_rates" (
"id" bigint default nextval('crystal_rates_id_seq'::regclass) not null,
"rate" numeric(8,4) not null,
"created_at" timestamp with time zone default now() not null,
"created_by" uuid
);
create table public."elk_plugin_launches" (
"id" uuid default gen_random_uuid() not null,
"user_email" text not null,
"work_date" date not null,
"launch_count" integer not null,
"synced_at" timestamp with time zone default now() not null,
"plugin_name" text default 'unknown'::text not null
);
create table public."elk_plugin_launches_baseline" (
"id" uuid default gen_random_uuid() not null,
"user_email" text not null,
"work_date" date not null,
"plugin_name" text not null,
"launch_count" integer not null,
"synced_at" timestamp with time zone default now() not null
);
create table public."gamification_balances" (
"user_id" uuid not null,
"total_coins" integer default 0 not null,
"updated_at" timestamp with time zone default now() not null
);
create table public."gamification_event_logs" (
"id" uuid default gen_random_uuid() not null,
"user_id" uuid not null,
"user_email" text not null,
"event_type" text not null,
"source" text not null,
"event_date" date not null,
"details" jsonb,
"created_at" timestamp with time zone default now() not null,
"idempotency_key" text,
"ranking_date" date not null
);
create table public."gamification_event_types" (
"key" text not null,
"coins" integer not null,
"description" text,
"is_active" boolean default true not null,
"created_at" timestamp with time zone default now() not null,
"updated_at" timestamp with time zone default now() not null,
"name" text not null,
"is_dynamic_coins" boolean default false not null,
"create_transaction" boolean default false not null
);
create table public."gamification_transactions" (
"id" uuid default gen_random_uuid() not null,
"user_id" uuid not null,
"user_email" text not null,
"event_id" uuid not null,
"coins" integer not null,
"created_at" timestamp with time zone default now() not null,
"byn_amount" numeric(12,2)
);
create table public."gratitudes" (
"id" uuid default gen_random_uuid() not null,
"sender_id" uuid not null,
"recipient_id" uuid not null,
"message" text default ''::text not null,
"category" text,
"created_at" timestamp with time zone default now() not null,
"type" text default 'gift'::text not null,
"gift_source" text,
"coins_amount" integer default 0
);
create table public."profiles" (
"user_id" uuid not null,
"first_name" text default ''::text not null,
"last_name" text default ''::text not null,
"team" text,
"department" text,
"created_at" timestamp with time zone default now() not null,
"updated_at" timestamp with time zone default now() not null,
"email" text not null,
"onboarding_seen" text[] default '{}'::text[] not null
);
create table public."shop_categories" (
"id" uuid default gen_random_uuid() not null,
"name" text not null,
"slug" text not null,
"description" text,
"is_physical" boolean default false not null,
"sort_order" integer default 0 not null,
"is_active" boolean default true not null,
"created_at" timestamp with time zone default now() not null,
"is_countable" boolean default true not null
);
create table public."shop_orders" (
"id" uuid default gen_random_uuid() not null,
"user_id" uuid not null,
"product_id" uuid not null,
"status" text not null,
"status_changed_by" uuid,
"status_changed_at" timestamp with time zone,
"transaction_id" uuid not null,
"refund_transaction_id" uuid,
"note" text,
"created_at" timestamp with time zone default now() not null,
"user_comment" text
);
create table public."shop_products" (
"id" uuid default gen_random_uuid() not null,
"name" text not null,
"description" text,
"category_id" uuid not null,
"image_url" text,
"emoji" text,
"is_active" boolean default true not null,
"stock" integer,
"sort_order" integer default 0 not null,
"created_by" uuid,
"created_at" timestamp with time zone default now() not null,
"updated_at" timestamp with time zone default now() not null,
"effect" text,
"cost_byn" numeric(10,2) default 0 not null,
"coefficient" numeric(5,2) default 1.0 not null,
"is_coming_soon" boolean default false not null,
"discount_percent" integer,
"comment_required" boolean default false not null,
"comment_label" text,
"comment_placeholder" text,
"price_adjustment_crystals" integer default 0 not null,
"media" jsonb default '[]'::jsonb not null
);
create table public."streak_shield_credits" (
"order_id" uuid not null,
"user_id" uuid not null,
"shield_type" text not null,
"purchased_at" timestamp with time zone default now() not null,
"consumed_at" timestamp with time zone
);
create table public."streak_shield_log" (
"id" uuid default gen_random_uuid() not null,
"user_id" uuid not null,
"shield_type" text not null,
"protected_date" date not null,
"order_id" uuid not null,
"created_at" timestamp with time zone default now() not null,
"notes" text,
"is_free" boolean default false not null
);
create table public."ws_daily_statuses" (
"user_id" uuid not null,
"date" date not null,
"status" text not null,
"absence_type" text,
"created_at" timestamp with time zone default now() not null,
"red_reasons" jsonb
);
create table public."ws_daily_statuses_baseline" (
"id" bigint generated always as identity not null,
"user_id" uuid not null,
"date" date not null,
"status" text not null,
"red_reasons" jsonb default '[]'::jsonb not null
);
create table public."ws_tasks_l2" (
"id" uuid default gen_random_uuid() not null,
"ws_task_id" text not null,
"ws_project_id" text not null,
"parent_l1_id" text,
"parent_l1_name" text,
"name" text not null,
"assignee_id" uuid,
"assignee_email" text,
"max_time" numeric,
"date_closed" timestamp with time zone,
"synced_at" timestamp with time zone default now() not null
);
create table public."ws_tasks_l3" (
"id" uuid default gen_random_uuid() not null,
"ws_task_id" text not null,
"ws_project_id" text not null,
"parent_l2_id" text not null,
"name" text not null,
"assignee_id" uuid,
"assignee_email" text,
"percent" smallint,
"max_time" numeric,
"date_closed" timestamp with time zone,
"synced_at" timestamp with time zone default now() not null,
"custom_status" text,
"date_end" date
);
create table public."ws_users" (
"id" uuid default gen_random_uuid() not null,
"ws_user_id" text not null,
"email" text not null,
"first_name" text not null,
"last_name" text not null,
"department" text,
"team" text,
"is_active" boolean default true not null,
"synced_at" timestamp with time zone default now() not null,
"user_id" uuid,
"department_code" text,
"is_admin" boolean default false not null
);
alter table public."admin_department_groups" add constraint "admin_department_groups_pkey" PRIMARY KEY (department);
alter table public."calendar_holidays" add constraint "calendar_holidays_pkey" PRIMARY KEY (id);
alter table public."calendar_workdays" add constraint "calendar_workdays_pkey" PRIMARY KEY (id);
alter table public."crystal_rates" add constraint "crystal_rates_pkey" PRIMARY KEY (id);
alter table public."elk_plugin_launches" add constraint "plugin_launches_pkey" PRIMARY KEY (id);
alter table public."elk_plugin_launches_baseline" add constraint "elk_plugin_launches_baseline_pkey" PRIMARY KEY (id);
alter table public."gamification_balances" add constraint "gamification_balances_pkey" PRIMARY KEY (user_id);
alter table public."gamification_event_logs" add constraint "gamification_events_pkey" PRIMARY KEY (id);
alter table public."gamification_event_types" add constraint "gamification_event_types_pkey" PRIMARY KEY (key);
alter table public."gamification_transactions" add constraint "gamification_transactions_pkey" PRIMARY KEY (id);
alter table public."gratitudes" add constraint "gratitudes_pkey1" PRIMARY KEY (id);
alter table public."profiles" add constraint "profiles_pkey" PRIMARY KEY (user_id);
alter table public."shop_categories" add constraint "shop_categories_pkey" PRIMARY KEY (id);
alter table public."shop_orders" add constraint "shop_orders_pkey" PRIMARY KEY (id);
alter table public."shop_products" add constraint "shop_products_pkey" PRIMARY KEY (id);
alter table public."streak_shield_credits" add constraint "streak_shield_credits_pkey" PRIMARY KEY (order_id);
alter table public."streak_shield_log" add constraint "streak_shield_log_pkey" PRIMARY KEY (id);
alter table public."ws_daily_statuses" add constraint "ws_daily_statuses_pkey" PRIMARY KEY (user_id, date);
alter table public."ws_daily_statuses_baseline" add constraint "ws_daily_statuses_baseline_pkey" PRIMARY KEY (id);
alter table public."ws_tasks_l2" add constraint "ws_tasks_l2_pkey" PRIMARY KEY (id);
alter table public."ws_tasks_l3" add constraint "ws_tasks_l3_pkey" PRIMARY KEY (id);
alter table public."ws_users" add constraint "ws_users_pkey" PRIMARY KEY (id);
alter table public."calendar_holidays" add constraint "calendar_holidays_date_key" UNIQUE (date);
alter table public."calendar_workdays" add constraint "calendar_workdays_date_key" UNIQUE (date);
alter table public."elk_plugin_launches" add constraint "plugin_launches_user_email_work_date_plugin_key" UNIQUE (user_email, work_date, plugin_name);
alter table public."elk_plugin_launches_baseline" add constraint "elk_plugin_launches_baseline_unique" UNIQUE (user_email, work_date, plugin_name);
alter table public."gamification_event_logs" add constraint "gamification_event_logs_idempotency_key_key" UNIQUE (idempotency_key);
alter table public."gamification_transactions" add constraint "gamification_transactions_event_id_key" UNIQUE (event_id);
alter table public."profiles" add constraint "profiles_email_key" UNIQUE (email);
alter table public."shop_categories" add constraint "shop_categories_name_key" UNIQUE (name);
alter table public."shop_categories" add constraint "shop_categories_slug_key" UNIQUE (slug);
alter table public."shop_orders" add constraint "shop_orders_refund_transaction_id_key" UNIQUE (refund_transaction_id);
alter table public."shop_orders" add constraint "shop_orders_transaction_id_key" UNIQUE (transaction_id);
alter table public."ws_daily_statuses_baseline" add constraint "ws_daily_statuses_baseline_user_id_date_key" UNIQUE (user_id, date);
alter table public."ws_tasks_l2" add constraint "ws_tasks_l2_ws_task_id_key" UNIQUE (ws_task_id);
alter table public."ws_tasks_l3" add constraint "ws_tasks_l3_ws_task_id_key" UNIQUE (ws_task_id);
alter table public."ws_users" add constraint "ws_users_email_key" UNIQUE (email);
alter table public."ws_users" add constraint "ws_users_ws_user_id_key" UNIQUE (ws_user_id);
alter table public."admin_department_groups" add constraint "admin_department_groups_group_type_check" CHECK ((group_type = ANY (ARRAY['designer'::text, 'non_designer'::text])));
alter table public."crystal_rates" add constraint "crystal_rates_rate_check" CHECK ((rate > (0)::numeric));
alter table public."elk_plugin_launches" add constraint "plugin_launches_launch_count_positive" CHECK ((launch_count > 0));
alter table public."elk_plugin_launches_baseline" add constraint "elk_plugin_launches_baseline_count_positive" CHECK ((launch_count > 0));
alter table public."gratitudes" add constraint "gratitudes_check" CHECK ((sender_id <> recipient_id));
alter table public."gratitudes" add constraint "gratitudes_gift_source_check" CHECK (((gift_source = ANY (ARRAY['quota'::text, 'balance'::text])) OR (gift_source IS NULL)));
alter table public."gratitudes" add constraint "gratitudes_type_check" CHECK ((type = ANY (ARRAY['thanks'::text, 'gift'::text])));
alter table public."shop_orders" add constraint "shop_orders_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'fulfilled'::text, 'cancelled'::text])));
alter table public."shop_products" add constraint "check_active_coming_soon_exclusive" CHECK ((NOT (is_active AND is_coming_soon)));
alter table public."shop_products" add constraint "shop_products_coefficient_check" CHECK ((coefficient > (0)::numeric));
alter table public."shop_products" add constraint "shop_products_discount_percent_check" CHECK (((discount_percent > 0) AND (discount_percent <= 500)));
alter table public."shop_products" add constraint "shop_products_media_is_array" CHECK ((jsonb_typeof(media) = 'array'::text));
alter table public."shop_products" add constraint "shop_products_price_adjustment_crystals_check" CHECK (((price_adjustment_crystals >= '-1000000000'::integer) AND (price_adjustment_crystals <= 1000000000)));
alter table public."shop_products" add constraint "shop_products_stock_check" CHECK ((stock >= 0));
alter table public."streak_shield_credits" add constraint "streak_shield_credits_shield_type_check" CHECK ((shield_type = ANY (ARRAY['ws'::text, 'revit'::text])));
alter table public."streak_shield_log" add constraint "streak_shield_log_shield_type_check" CHECK ((shield_type = ANY (ARRAY['ws'::text, 'revit'::text])));
alter table public."ws_daily_statuses" add constraint "ws_daily_statuses_status_check" CHECK ((status = ANY (ARRAY['green'::text, 'red'::text, 'absent'::text])));
alter table public."ws_daily_statuses_baseline" add constraint "ws_daily_statuses_baseline_status_check" CHECK ((status = ANY (ARRAY['green'::text, 'red'::text, 'absent'::text])));
alter table public."ws_users" add constraint "ws_users_email_lowercase" CHECK ((email = lower(email)));
alter table public."calendar_holidays" add constraint "calendar_holidays_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public."calendar_workdays" add constraint "calendar_workdays_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public."crystal_rates" add constraint "crystal_rates_created_by_fkey" FOREIGN KEY (created_by) REFERENCES ws_users(id) ON DELETE SET NULL;
alter table public."gamification_balances" add constraint "gamification_balances_user_id_fkey" FOREIGN KEY (user_id) REFERENCES ws_users(id);
alter table public."gamification_event_logs" add constraint "gamification_event_logs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES ws_users(id);
alter table public."gamification_event_logs" add constraint "gamification_events_event_type_fkey" FOREIGN KEY (event_type) REFERENCES gamification_event_types(key) ON UPDATE CASCADE;
alter table public."gamification_transactions" add constraint "gamification_transactions_event_id_fkey" FOREIGN KEY (event_id) REFERENCES gamification_event_logs(id);
alter table public."gamification_transactions" add constraint "gamification_transactions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES ws_users(id);
alter table public."gratitudes" add constraint "gratitudes_recipient_id_fkey" FOREIGN KEY (recipient_id) REFERENCES ws_users(id);
alter table public."gratitudes" add constraint "gratitudes_sender_id_fkey" FOREIGN KEY (sender_id) REFERENCES ws_users(id);
alter table public."profiles" add constraint "profiles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."shop_orders" add constraint "shop_orders_product_id_fkey" FOREIGN KEY (product_id) REFERENCES shop_products(id);
alter table public."shop_orders" add constraint "shop_orders_refund_transaction_id_fkey" FOREIGN KEY (refund_transaction_id) REFERENCES gamification_transactions(id);
alter table public."shop_orders" add constraint "shop_orders_status_changed_by_fkey" FOREIGN KEY (status_changed_by) REFERENCES ws_users(id);
alter table public."shop_orders" add constraint "shop_orders_transaction_id_fkey" FOREIGN KEY (transaction_id) REFERENCES gamification_transactions(id);
alter table public."shop_orders" add constraint "shop_orders_user_id_fkey" FOREIGN KEY (user_id) REFERENCES ws_users(id);
alter table public."shop_products" add constraint "shop_products_category_id_fkey" FOREIGN KEY (category_id) REFERENCES shop_categories(id);
alter table public."shop_products" add constraint "shop_products_created_by_fkey" FOREIGN KEY (created_by) REFERENCES ws_users(id);
alter table public."streak_shield_credits" add constraint "streak_shield_credits_order_id_fkey" FOREIGN KEY (order_id) REFERENCES shop_orders(id);
alter table public."streak_shield_credits" add constraint "streak_shield_credits_user_id_fkey" FOREIGN KEY (user_id) REFERENCES ws_users(id);
alter table public."streak_shield_log" add constraint "streak_shield_log_order_id_fkey" FOREIGN KEY (order_id) REFERENCES shop_orders(id);
alter table public."streak_shield_log" add constraint "streak_shield_log_user_id_fkey" FOREIGN KEY (user_id) REFERENCES ws_users(id);
alter table public."ws_daily_statuses" add constraint "ws_daily_statuses_user_id_fkey" FOREIGN KEY (user_id) REFERENCES ws_users(id) ON DELETE CASCADE;
alter table public."ws_tasks_l2" add constraint "ws_tasks_l2_assignee_id_fkey" FOREIGN KEY (assignee_id) REFERENCES ws_users(id);
alter table public."ws_tasks_l3" add constraint "ws_tasks_l3_assignee_id_fkey" FOREIGN KEY (assignee_id) REFERENCES ws_users(id);
alter table public."ws_tasks_l3" add constraint "ws_tasks_l3_parent_l2_id_fkey" FOREIGN KEY (parent_l2_id) REFERENCES ws_tasks_l2(ws_task_id);
alter table public."ws_users" add constraint "ws_users_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE OR REPLACE FUNCTION public.current_crystal_rate()
 RETURNS numeric
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT rate FROM crystal_rates ORDER BY id DESC LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.process_gamification_event(p_user_id uuid, p_user_email text, p_event_type text, p_source text, p_event_date date, p_details jsonb, p_idempotency_key text, p_coins integer, p_create_transaction boolean DEFAULT false)
 RETURNS TABLE(event_id uuid, skipped boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_event_id uuid;
  v_current_balance integer;
  v_applied_coins integer;
BEGIN
  INSERT INTO gamification_event_logs (
    user_id, user_email, event_type, source, event_date, details, idempotency_key
  )
  VALUES (
    p_user_id, p_user_email, p_event_type, p_source, p_event_date, p_details, p_idempotency_key
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_event_id;

  IF v_event_id IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, true;
    RETURN;
  END IF;

  IF p_coins = 0 AND NOT p_create_transaction THEN
    RETURN QUERY SELECT v_event_id, false;
    RETURN;
  END IF;

  v_applied_coins := p_coins;

  IF p_coins < 0 THEN
    SELECT total_coins INTO v_current_balance
    FROM gamification_balances
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF v_current_balance IS NULL OR v_current_balance <= 0 THEN
      RETURN QUERY SELECT v_event_id, false;
      RETURN;
    END IF;

    IF v_current_balance + p_coins < 0 THEN
      v_applied_coins := -v_current_balance;
    END IF;
  END IF;

  INSERT INTO gamification_transactions (user_id, user_email, event_id, coins)
  VALUES (p_user_id, p_user_email, v_event_id, v_applied_coins);

  INSERT INTO gamification_balances (user_id, total_coins, updated_at)
  VALUES (p_user_id, v_applied_coins, now())
  ON CONFLICT (user_id) DO UPDATE
    SET total_coins = gamification_balances.total_coins + v_applied_coins,
        updated_at  = now();

  RETURN QUERY SELECT v_event_id, false;
END;
$function$;

CREATE OR REPLACE FUNCTION public.purchase_product(p_product_id uuid, p_user_id uuid, p_user_comment text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_user_email         text;
  v_product_name       text;
  v_cost_byn           numeric;
  v_coefficient        numeric;
  v_price_adjustment integer;
  v_rate               numeric;
  v_price              integer;
  v_is_active          boolean;
  v_stock              integer;
  v_is_physical        boolean;
  v_is_countable       boolean;
  v_cat_is_active      boolean;
  v_comment_required   boolean;
  v_balance            integer;
  v_order_id           uuid;
  v_event_id           uuid;
  v_tx_id              uuid;
  v_order_status       text;
BEGIN
  -- 0. Email покупателя
  SELECT email INTO v_user_email
  FROM public.ws_users WHERE id = p_user_id;
  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'Пользователь не найден в системе';
  END IF;

  -- 1. Товар + категория, блокировка строки товара
  SELECT p.name, p.cost_byn, p.coefficient, p.price_adjustment_crystals, p.is_active, p.stock,
         p.comment_required,
         c.is_physical, c.is_countable, c.is_active
  INTO v_product_name, v_cost_byn, v_coefficient, v_price_adjustment, v_is_active, v_stock,
       v_comment_required,
       v_is_physical, v_is_countable, v_cat_is_active
  FROM public.shop_products p
  JOIN public.shop_categories c ON p.category_id = c.id
  WHERE p.id = p_product_id
  FOR UPDATE OF p;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Товар не найден';
  END IF;
  IF NOT v_is_active OR NOT v_cat_is_active THEN
    RAISE EXCEPTION 'Товар недоступен';
  END IF;
  IF v_is_countable AND v_stock IS NOT NULL AND v_stock = 0 THEN
    RAISE EXCEPTION 'Нет в наличии';
  END IF;

  -- 2. Валидация комментария
  IF v_comment_required AND (p_user_comment IS NULL OR trim(p_user_comment) = '') THEN
    RAISE EXCEPTION 'comment_required';
  END IF;

  -- 3. Текущий курс + цена в кристаллах
  v_rate := public.current_crystal_rate();
  v_price := greatest(1, round(v_cost_byn * v_coefficient * v_rate)::integer + v_price_adjustment);

  -- 4. Баланс с блокировкой
  SELECT total_coins INTO v_balance
  FROM public.gamification_balances
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND OR v_balance < v_price THEN
    RAISE EXCEPTION 'Недостаточно коинов';
  END IF;

  -- 5. order_id
  v_order_id := gen_random_uuid();

  -- 6. Event log
  INSERT INTO public.gamification_event_logs (
    user_id, user_email, event_type, source, event_date,
    details, idempotency_key
  ) VALUES (
    p_user_id, v_user_email, 'shop_purchase', 'shop', CURRENT_DATE,
    jsonb_build_object('product_id', p_product_id, 'product_name', v_product_name, 'order_id', v_order_id),
    'shop_purchase_' || v_order_id::text
  )
  RETURNING id INTO v_event_id;

  -- 7. Транзакция списания (byn_amount проставит триггер trg_set_byn_amount)
  INSERT INTO public.gamification_transactions (
    user_id, user_email, event_id, coins
  ) VALUES (
    p_user_id, v_user_email, v_event_id, -v_price
  )
  RETURNING id INTO v_tx_id;

  -- 8. Баланс
  UPDATE public.gamification_balances
  SET total_coins = total_coins - v_price, updated_at = now()
  WHERE user_id = p_user_id;

  -- 9. Заказ с комментарием
  v_order_status := CASE WHEN v_is_physical THEN 'pending' ELSE 'fulfilled' END;

  INSERT INTO public.shop_orders (
    id, user_id, product_id, status, transaction_id, user_comment
  ) VALUES (
    v_order_id, p_user_id, p_product_id, v_order_status, v_tx_id,
    NULLIF(trim(p_user_comment), '')
  );

  -- 10. Stock
  IF v_is_countable AND v_stock IS NOT NULL THEN
    UPDATE public.shop_products
    SET stock = stock - 1, updated_at = now()
    WHERE id = p_product_id;
  END IF;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'status', v_order_status,
    'coins_spent', v_price
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_set_byn_amount()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.byn_amount IS NULL THEN
    NEW.byn_amount := round(NEW.coins::numeric / current_crystal_rate(), 2);
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.adoption_designer_cohort_v2()
 RETURNS TABLE(id uuid, email text, first_name text, last_name text, department text, team text)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT u.id, lower(u.email), u.first_name, u.last_name, u.department, NULLIF(u.team, '')
  FROM public.ws_users u
  WHERE u.is_active = true
    AND EXISTS (
      SELECT 1 FROM public.admin_department_groups g
      WHERE g.department = u.department AND g.group_type = 'designer'
    );
$function$;

CREATE OR REPLACE FUNCTION public.fn_fix_ws_event_date()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.source = 'ws' THEN
    NEW.ranking_date := CASE
      WHEN NEW.event_type IN (
        'green_day', 'red_day', 'task_dynamics_violation', 'section_red',
        'wrong_status_report', 'streak_reset_timetracking',
        'streak_reset_dynamics', 'streak_reset_section',
        'streak_reset_wrong_status', 'ws_streak_7', 'ws_streak_30',
        'ws_streak_90', 'streak_daily_bonus'
      ) THEN NEW.event_date
      ELSE (COALESCE(NEW.created_at, now()) AT TIME ZONE 'Europe/Minsk')::date
    END;
    NEW.event_date := NEW.event_date + 1;
  ELSE
    NEW.ranking_date := NEW.event_date;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.guard_streak_shield_order_cancel()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    IF EXISTS (SELECT 1 FROM public.streak_shield_log WHERE order_id = OLD.id) THEN
      RAISE EXCEPTION 'Применённую защиту нельзя вернуть';
    END IF;
    DELETE FROM public.streak_shield_credits
    WHERE order_id = OLD.id AND consumed_at IS NULL;
    IF EXISTS (SELECT 1 FROM public.streak_shield_credits WHERE order_id = OLD.id) THEN
      RAISE EXCEPTION 'Применённую защиту нельзя вернуть';
    END IF;
  END IF;
  RETURN NEW;
END $function$;
CREATE TRIGGER trg_fix_ws_event_date BEFORE INSERT ON public.gamification_event_logs FOR EACH ROW EXECUTE FUNCTION fn_fix_ws_event_date();
CREATE TRIGGER trg_set_byn_amount BEFORE INSERT ON public.gamification_transactions FOR EACH ROW EXECUTE FUNCTION fn_set_byn_amount();
CREATE TRIGGER guard_streak_shield_order_cancel BEFORE UPDATE OF status ON public.shop_orders FOR EACH ROW EXECUTE FUNCTION guard_streak_shield_order_cancel();
alter table public."admin_department_groups" enable row level security;
alter table public."calendar_holidays" enable row level security;
alter table public."calendar_workdays" enable row level security;
alter table public."crystal_rates" enable row level security;
alter table public."elk_plugin_launches" enable row level security;
alter table public."elk_plugin_launches_baseline" enable row level security;
alter table public."gamification_balances" enable row level security;
alter table public."gamification_event_logs" enable row level security;
alter table public."gamification_event_types" enable row level security;
alter table public."gamification_transactions" enable row level security;
alter table public."gratitudes" enable row level security;
alter table public."profiles" enable row level security;
alter table public."shop_categories" enable row level security;
alter table public."shop_orders" enable row level security;
alter table public."shop_products" enable row level security;
alter table public."streak_shield_credits" enable row level security;
alter table public."streak_shield_log" enable row level security;
alter table public."ws_daily_statuses" enable row level security;
alter table public."ws_daily_statuses_baseline" enable row level security;
alter table public."ws_tasks_l2" enable row level security;
alter table public."ws_tasks_l3" enable row level security;
alter table public."ws_users" enable row level security;
grant usage on schema public,extensions to service_role;
grant select,insert,update,delete on all tables in schema public to service_role;
grant usage,select on all sequences in schema public to service_role;
CREATE OR REPLACE FUNCTION public.get_economy_overview(p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH
  earned AS (
    SELECT COALESCE(SUM(t.coins), 0)::bigint AS total
    FROM gamification_transactions t
    JOIN ws_users u ON u.id = t.user_id
    WHERE t.coins > 0
      AND (p_from IS NULL OR t.created_at >= p_from)
      AND (p_to IS NULL OR t.created_at < p_to)
  ),
  revoked AS (
    SELECT
      COALESCE(SUM(ABS(t.coins)), 0)::bigint AS actual,
      COALESCE(SUM(GREATEST(ABS(et.coins) - ABS(t.coins), 0)), 0)::bigint AS gifted,
      COUNT(*) FILTER (WHERE ABS(t.coins) < ABS(et.coins))::bigint AS clamped_count,
      COUNT(*)::bigint AS total_count
    FROM gamification_transactions t
    JOIN gamification_event_logs el ON el.id = t.event_id
    JOIN gamification_event_types et ON et.key = el.event_type
    JOIN ws_users u ON u.id = t.user_id
    LEFT JOIN ws_tasks_l3 t3 ON t3.ws_task_id = COALESCE(
      el.details->>'ws_task_id',
      el.details->'exceeded_task'->>'id',
      el.details->'original_details'->>'ws_task_id'
    )
    LEFT JOIN ws_tasks_l2 t2 ON t2.ws_task_id = COALESCE(
      el.details->>'ws_task_id',
      el.details->'exceeded_task'->>'id',
      el.details->'original_details'->>'ws_task_id'
    )
    WHERE el.event_type LIKE '%revoked%'
      AND et.coins < 0
      AND t.coins <= 0
      AND COALESCE(
        t3.date_closed::date,
        t2.date_closed::date,
        (el.details->'original_details'->>'date_closed')::date,
        el.event_date
      ) >= '2026-03-25'::date
      AND (p_from IS NULL OR t.created_at >= p_from)
      AND (p_to IS NULL OR t.created_at < p_to)
  ),
  shop AS (
    SELECT
      COALESCE(SUM(ABS(t.coins)), 0)::bigint AS coins,
      COUNT(DISTINCT o.user_id)::bigint AS users
    FROM shop_orders o
    JOIN gamification_transactions t ON t.id = o.transaction_id
    JOIN shop_products p ON p.id = o.product_id
    JOIN shop_categories c ON c.id = p.category_id
    JOIN ws_users u ON u.id = o.user_id
    WHERE o.status <> 'cancelled'
      AND c.slug <> 'draw'
      AND p.effect IS NULL
      AND (p_from IS NULL OR o.created_at >= p_from)
      AND (p_to IS NULL OR o.created_at < p_to)
  ),
  lottery AS (
    SELECT
      COALESCE(SUM(ABS(t.coins)), 0)::bigint AS coins,
      COUNT(DISTINCT o.user_id)::bigint AS users
    FROM shop_orders o
    JOIN gamification_transactions t ON t.id = o.transaction_id
    JOIN shop_products p ON p.id = o.product_id
    JOIN shop_categories c ON c.id = p.category_id
    JOIN ws_users u ON u.id = o.user_id
    WHERE o.status <> 'cancelled'
      AND c.slug = 'draw'
      AND (p_from IS NULL OR o.created_at >= p_from)
      AND (p_to IS NULL OR o.created_at < p_to)
  ),
  second_life AS (
    SELECT
      COALESCE(SUM(ABS(t.coins)), 0)::bigint AS coins,
      COUNT(DISTINCT o.user_id)::bigint AS users
    FROM shop_orders o
    JOIN gamification_transactions t ON t.id = o.transaction_id
    JOIN shop_products p ON p.id = o.product_id
    JOIN ws_users u ON u.id = o.user_id
    WHERE o.status <> 'cancelled'
      AND p.effect IN ('streak_shield_ws','streak_shield_revit')
      AND (p_from IS NULL OR o.created_at >= p_from)
      AND (p_to IS NULL OR o.created_at < p_to)
  ),
  paid_gratitudes AS (
    SELECT
      COALESCE(SUM(g.coins_amount), 0)::bigint AS coins,
      COUNT(DISTINCT g.sender_id)::bigint AS users
    FROM gratitudes g
    JOIN ws_users u ON u.id = g.sender_id
    WHERE g.gift_source = 'balance'
      AND (p_from IS NULL OR g.created_at >= p_from)
      AND (p_to IS NULL OR g.created_at < p_to)
  ),
  quota_gratitudes AS (
    SELECT
      COALESCE(SUM(t.coins), 0)::bigint AS coins,
      COUNT(DISTINCT g.sender_id)::bigint AS users
    FROM gratitudes g
    JOIN gamification_event_logs el ON (el.details->>'gratitude_id')::uuid = g.id
    JOIN gamification_transactions t ON t.event_id = el.id
    JOIN ws_users u ON u.id = g.sender_id
    WHERE g.gift_source = 'quota'
      AND el.event_type = 'gratitude_recipient_points'
      AND (p_from IS NULL OR g.created_at >= p_from)
      AND (p_to IS NULL OR g.created_at < p_to)
  )
  SELECT jsonb_build_object(
    'earned', earned.total,
    'revoked_actual', revoked.actual,
    'factually_earned', earned.total - revoked.actual,
    'gifted_by_company', revoked.gifted,
    'clamped_count', revoked.clamped_count,
    'total_revoked_count', revoked.total_count,
    'channels', jsonb_build_object(
      'shop', jsonb_build_object('coins', shop.coins, 'users', shop.users),
      'lottery', jsonb_build_object('coins', lottery.coins, 'users', lottery.users),
      'second_life', jsonb_build_object('coins', second_life.coins, 'users', second_life.users),
      'paid_gratitudes', jsonb_build_object('coins', paid_gratitudes.coins, 'users', paid_gratitudes.users),
      'quota_gratitudes', jsonb_build_object('coins', quota_gratitudes.coins, 'users', quota_gratitudes.users)
    )
  )
  FROM earned, revoked, shop, lottery, second_life, paid_gratitudes, quota_gratitudes;
$function$;

CREATE OR REPLACE FUNCTION public.get_economy_top(p_from timestamp with time zone, p_to timestamp with time zone, p_source text, p_level text)
 RETURNS TABLE(id text, name text, value bigint, secondary bigint)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_level NOT IN ('user', 'team', 'department') THEN
    RAISE EXCEPTION 'Unknown level: %', p_level;
  END IF;

  IF p_source = 'earned' THEN
    RETURN QUERY
    WITH base AS (
      SELECT u.id AS user_id, u.first_name, u.last_name, u.team, u.department, t.coins
      FROM gamification_transactions t
      JOIN ws_users u ON u.id = t.user_id
      WHERE t.coins > 0
        AND (p_from IS NULL OR t.created_at >= p_from)
        AND (p_to IS NULL OR t.created_at < p_to)
    )
    SELECT
      CASE p_level
        WHEN 'user' THEN b.user_id::text
        WHEN 'team' THEN COALESCE(b.team, '__no_team__')
        WHEN 'department' THEN COALESCE(b.department, '__no_dept__')
      END,
      CASE p_level
        WHEN 'user' THEN NULLIF(TRIM(COALESCE(b.first_name, '') || ' ' || COALESCE(b.last_name, '')), '')
        WHEN 'team' THEN COALESCE(b.team, 'Без команды')
        WHEN 'department' THEN COALESCE(b.department, 'Без отдела')
      END,
      SUM(b.coins)::bigint,
      NULL::bigint
    FROM base b
    GROUP BY 1, 2
    ORDER BY 3 DESC NULLS LAST;

  ELSIF p_source = 'revoked' THEN
    RETURN QUERY
    WITH base AS (
      SELECT u.id AS user_id, u.first_name, u.last_name, u.team, u.department, t.coins
      FROM gamification_transactions t
      JOIN gamification_event_logs el ON el.id = t.event_id
      JOIN ws_users u ON u.id = t.user_id
      LEFT JOIN ws_tasks_l3 t3 ON t3.ws_task_id = COALESCE(
        el.details->>'ws_task_id',
        el.details->'exceeded_task'->>'id',
        el.details->'original_details'->>'ws_task_id'
      )
      LEFT JOIN ws_tasks_l2 t2 ON t2.ws_task_id = COALESCE(
        el.details->>'ws_task_id',
        el.details->'exceeded_task'->>'id',
        el.details->'original_details'->>'ws_task_id'
      )
      WHERE el.event_type LIKE '%revoked%'
        AND COALESCE(
          t3.date_closed::date,
          t2.date_closed::date,
          (el.details->'original_details'->>'date_closed')::date,
          el.event_date
        ) >= '2026-03-25'::date
        AND (p_from IS NULL OR t.created_at >= p_from)
        AND (p_to IS NULL OR t.created_at < p_to)
    )
    SELECT
      CASE p_level
        WHEN 'user' THEN b.user_id::text
        WHEN 'team' THEN COALESCE(b.team, '__no_team__')
        WHEN 'department' THEN COALESCE(b.department, '__no_dept__')
      END,
      CASE p_level
        WHEN 'user' THEN NULLIF(TRIM(COALESCE(b.first_name, '') || ' ' || COALESCE(b.last_name, '')), '')
        WHEN 'team' THEN COALESCE(b.team, 'Без команды')
        WHEN 'department' THEN COALESCE(b.department, 'Без отдела')
      END,
      SUM(ABS(b.coins))::bigint,
      NULL::bigint
    FROM base b
    GROUP BY 1, 2
    ORDER BY 3 DESC NULLS LAST;

  ELSIF p_source IN ('shop', 'lottery', 'second_life') THEN
    RETURN QUERY
    WITH base AS (
      SELECT u.id AS user_id, u.first_name, u.last_name, u.team, u.department, t.coins
      FROM shop_orders o
      JOIN gamification_transactions t ON t.id = o.transaction_id
      JOIN shop_products p ON p.id = o.product_id
      JOIN shop_categories c ON c.id = p.category_id
      JOIN ws_users u ON u.id = o.user_id
      WHERE o.status <> 'cancelled'
        AND (CASE p_source
          WHEN 'shop' THEN (c.slug <> 'draw' AND p.effect IS NULL)
          WHEN 'lottery' THEN (c.slug = 'draw')
          WHEN 'second_life' THEN (p.effect IN ('streak_shield_ws','streak_shield_revit'))
        END)
        AND (p_from IS NULL OR o.created_at >= p_from)
        AND (p_to IS NULL OR o.created_at < p_to)
    )
    SELECT
      CASE p_level
        WHEN 'user' THEN b.user_id::text
        WHEN 'team' THEN COALESCE(b.team, '__no_team__')
        WHEN 'department' THEN COALESCE(b.department, '__no_dept__')
      END,
      CASE p_level
        WHEN 'user' THEN NULLIF(TRIM(COALESCE(b.first_name, '') || ' ' || COALESCE(b.last_name, '')), '')
        WHEN 'team' THEN COALESCE(b.team, 'Без команды')
        WHEN 'department' THEN COALESCE(b.department, 'Без отдела')
      END,
      SUM(ABS(b.coins))::bigint,
      COUNT(*)::bigint
    FROM base b
    GROUP BY 1, 2
    ORDER BY 3 DESC NULLS LAST;

  ELSIF p_source = 'paid_gratitude' THEN
    RETURN QUERY
    WITH base AS (
      SELECT u.id AS user_id, u.first_name, u.last_name, u.team, u.department, g.coins_amount
      FROM gratitudes g
      JOIN ws_users u ON u.id = g.sender_id
      WHERE g.gift_source = 'balance'
        AND (p_from IS NULL OR g.created_at >= p_from)
        AND (p_to IS NULL OR g.created_at < p_to)
    )
    SELECT
      CASE p_level
        WHEN 'user' THEN b.user_id::text
        WHEN 'team' THEN COALESCE(b.team, '__no_team__')
        WHEN 'department' THEN COALESCE(b.department, '__no_dept__')
      END,
      CASE p_level
        WHEN 'user' THEN NULLIF(TRIM(COALESCE(b.first_name, '') || ' ' || COALESCE(b.last_name, '')), '')
        WHEN 'team' THEN COALESCE(b.team, 'Без команды')
        WHEN 'department' THEN COALESCE(b.department, 'Без отдела')
      END,
      SUM(b.coins_amount)::bigint,
      COUNT(*)::bigint
    FROM base b
    GROUP BY 1, 2
    ORDER BY 3 DESC NULLS LAST;

  ELSE
    RAISE EXCEPTION 'Unknown source: %', p_source;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_adoption_period_core_v2(p_from date, p_to date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
DECLARE v_result jsonb;
BEGIN
  IF p_to IS NULL OR (p_from IS NOT NULL AND p_from > p_to) THEN RAISE EXCEPTION 'Invalid adoption period'; END IF;
  WITH
  bounds AS MATERIALIZED (
    SELECT CASE WHEN p_from IS NULL THEN NULL ELSE p_from::timestamp AT TIME ZONE 'Europe/Minsk' END AS from_ts,
      (p_to+1)::timestamp AT TIME ZONE 'Europe/Minsk' AS to_ts,
      COALESCE(p_from,(SELECT LEAST(
        COALESCE((SELECT min((created_at AT TIME ZONE 'Europe/Minsk')::date) FROM public.profiles),p_to),
        COALESCE((SELECT min(date) FROM public.ws_daily_statuses_baseline),p_to),
        COALESCE((SELECT min(work_date) FROM public.elk_plugin_launches_baseline),p_to)
      ))) AS effective_from
  ),
  cohort AS MATERIALIZED (
    SELECT c.*,EXISTS (SELECT 1 FROM public.profiles p,bounds b WHERE lower(p.email)=c.email AND p.created_at<b.to_ts) AS logged_in
    FROM public.adoption_designer_cohort_v2() c
  ),
  period_tx AS MATERIALIZED (
    SELECT t.user_id,t.coins FROM public.gamification_transactions t JOIN cohort c ON c.id=t.user_id CROSS JOIN bounds b
    WHERE (b.from_ts IS NULL OR t.created_at>=b.from_ts) AND t.created_at<b.to_ts
  ),
  days AS MATERIALIZED (SELECT generate_series(effective_from,p_to,interval '1 day')::date AS day FROM bounds),
  improvement_days AS MATERIALIZED (SELECT day FROM days WHERE day>=DATE '2026-07-01'),
  logins AS MATERIALIZED (
    SELECT c.id,min((p.created_at AT TIME ZONE 'Europe/Minsk')::date) login_day FROM cohort c LEFT JOIN public.profiles p ON lower(p.email)=c.email GROUP BY c.id
  ),
  status_source AS MATERIALIZED (
    SELECT s.user_id,s.date,s.status FROM public.ws_daily_statuses_baseline s JOIN cohort c ON c.id=s.user_id
    UNION ALL SELECT s.user_id,s.date,s.status FROM public.ws_daily_statuses s JOIN cohort c ON c.id=s.user_id
  ),
  ws_base AS MATERIALIZED (
    SELECT c.id,c.logged_in,count(*) FILTER (WHERE s.status='green')::numeric/NULLIF(count(*) FILTER (WHERE s.status IN ('green','red')),0) ratio
    FROM cohort c LEFT JOIN status_source s ON s.user_id=c.id AND s.date BETWEEN DATE '2026-06-29' AND DATE '2026-06-30'
    GROUP BY c.id,c.logged_in
  ),
  ws_grid AS MATERIALIZED (
    SELECT d.day,b.id,b.logged_in,b.ratio,
      count(s.*) FILTER (WHERE s.status='green') AS green_day,
      count(s.*) FILTER (WHERE s.status IN ('green','red')) AS tracked_day
    FROM improvement_days d CROSS JOIN ws_base b
    LEFT JOIN status_source s ON s.user_id=b.id AND s.date=d.day
    GROUP BY d.day,b.id,b.logged_in,b.ratio
  ),
  ws_running AS MATERIALIZED (
    SELECT day,id,logged_in,ratio,
      sum(green_day) OVER (PARTITION BY id ORDER BY day) AS green_total,
      sum(tracked_day) OVER (PARTITION BY id ORDER BY day) AS tracked_total
    FROM ws_grid
  ),
  ws_improved AS MATERIALIZED (
    SELECT day,logged_in,count(*) FILTER (WHERE green_total::numeric/NULLIF(tracked_total,0)>ratio)::bigint cnt
    FROM ws_running WHERE ratio IS NOT NULL GROUP BY day,logged_in
  ),
  calendar_days AS MATERIALIZED (
    SELECT d.day,(EXISTS (SELECT 1 FROM public.calendar_workdays w WHERE w.date=d.day)
      OR (extract(isodow FROM d.day) BETWEEN 1 AND 5 AND NOT EXISTS (SELECT 1 FROM public.calendar_holidays h WHERE h.date=d.day))) AS is_workday
    FROM improvement_days d
  ),
  rv_base AS MATERIALIZED (
    SELECT c.id,c.email,c.logged_in,COALESCE(sum(e.launch_count),0)::numeric/2 per_day
    FROM cohort c LEFT JOIN public.elk_plugin_launches_baseline e ON lower(e.user_email)=c.email AND e.work_date BETWEEN DATE '2026-06-29' AND DATE '2026-06-30'
    GROUP BY c.id,c.email,c.logged_in
  ),
  rv_daily AS MATERIALIZED (
    SELECT lower(e.user_email) email,e.work_date,sum(e.launch_count)::bigint launches
    FROM public.elk_plugin_launches e JOIN cohort c ON c.email=lower(e.user_email)
    WHERE e.work_date BETWEEN DATE '2026-07-01' AND p_to GROUP BY 1,2
  ),
  rv_grid AS MATERIALIZED (
    SELECT d.day,b.id,b.logged_in,b.per_day,d.is_workday,COALESCE(r.launches,0) launches
    FROM calendar_days d CROSS JOIN rv_base b LEFT JOIN rv_daily r ON r.email=b.email AND r.work_date=d.day
  ),
  rv_running AS MATERIALIZED (
    SELECT day,id,logged_in,per_day,
      sum(launches) OVER (PARTITION BY id ORDER BY day) launches_total,
      count(*) FILTER (WHERE is_workday) OVER (PARTITION BY id ORDER BY day) workdays_total
    FROM rv_grid
  ),
  rv_improved AS MATERIALIZED (
    SELECT day,logged_in,count(*) FILTER (WHERE launches_total::numeric/NULLIF(workdays_total,0)>per_day)::bigint cnt
    FROM rv_running GROUP BY day,logged_in
  ),
  all_workdays AS MATERIALIZED (
    SELECT d.day FROM days d WHERE EXISTS (SELECT 1 FROM public.calendar_workdays w WHERE w.date=d.day)
      OR (extract(isodow FROM d.day) BETWEEN 1 AND 5 AND NOT EXISTS (SELECT 1 FROM public.calendar_holidays h WHERE h.date=d.day))
  ),
  plugin_source AS MATERIALIZED (
    SELECT lower(user_email) email,work_date FROM public.elk_plugin_launches_baseline
    UNION ALL SELECT lower(user_email),work_date FROM public.elk_plugin_launches
  ),
  overview_days AS MATERIALIZED (
    SELECT d.day,(SELECT count(*) FROM logins l WHERE l.login_day<=d.day)::bigint logged_in,
      (SELECT sum(cnt) FROM ws_improved w WHERE w.day=d.day)::bigint improved_ws,
      (SELECT sum(cnt) FROM rv_improved r WHERE r.day=d.day)::bigint improved_revit,
      (SELECT cnt FROM ws_improved w WHERE w.day=d.day AND w.logged_in)::bigint improved_ws_logged,
      (SELECT cnt FROM rv_improved r WHERE r.day=d.day AND r.logged_in)::bigint improved_revit_logged,
      (SELECT cnt FROM ws_improved w WHERE w.day=d.day AND NOT w.logged_in)::bigint improved_ws_not_logged,
      (SELECT cnt FROM rv_improved r WHERE r.day=d.day AND NOT r.logged_in)::bigint improved_revit_not_logged
    FROM days d
  ),
  revit_chart AS MATERIALIZED (
    SELECT w.day,count(DISTINCT p.email)::bigint users FROM all_workdays w
    LEFT JOIN plugin_source p ON p.work_date=w.day AND p.email IN (SELECT email FROM cohort) GROUP BY w.day
  )
  SELECT jsonb_build_object(
    'coverage',jsonb_build_object(
      'company_total',(SELECT count(*) FROM public.ws_users WHERE is_active=true),
      'total_employees',(SELECT count(*) FROM cohort),'profiles_count',(SELECT count(*) FROM cohort WHERE logged_in),
      'earned_total',(SELECT COALESCE(sum(coins) FILTER (WHERE coins>0),0) FROM period_tx),
      'earned_logged',(SELECT COALESCE(sum(t.coins) FILTER (WHERE t.coins>0 AND c.logged_in),0) FROM period_tx t JOIN cohort c ON c.id=t.user_id),
      'earners',(SELECT count(DISTINCT user_id) FROM period_tx WHERE coins>0),
      'spent_total',(SELECT COALESCE(-sum(coins) FILTER (WHERE coins<0),0) FROM period_tx),
      'balance_at_to',(SELECT COALESCE(sum(bal.total_coins),0)-COALESCE((SELECT sum(t.coins) FROM public.gamification_transactions t JOIN cohort c2 ON c2.id=t.user_id CROSS JOIN bounds bo WHERE t.created_at>=bo.to_ts),0) FROM public.gamification_balances bal JOIN cohort c ON c.id=bal.user_id)
    ),
    'overview',jsonb_build_object(
      'total_cohort',(SELECT count(*) FROM cohort),
      'users_daily',COALESCE((SELECT jsonb_agg(jsonb_build_object('day',day,'logged_in',logged_in,'improved_ws',improved_ws,'improved_revit',improved_revit,'improved_ws_logged',improved_ws_logged,'improved_revit_logged',improved_revit_logged,'improved_ws_not_logged',improved_ws_not_logged,'improved_revit_not_logged',improved_revit_not_logged) ORDER BY day) FROM overview_days),'[]'::jsonb),
      'revit_daily',COALESCE((SELECT jsonb_agg(jsonb_build_object('day',day,'users',users) ORDER BY day) FROM revit_chart),'[]'::jsonb),
      'login_users',COALESCE((SELECT jsonb_agg(jsonb_build_object('department',department,'team',team,'user_name',trim(COALESCE(last_name,'')||' '||COALESCE(first_name,'')),'logged_in',logged_in) ORDER BY department,team,logged_in,last_name,first_name) FROM cohort),'[]'::jsonb)
    )
  ) INTO v_result;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_adoption_monthly_summary_v3(p_from date, p_to date, p_scope text DEFAULT 'designer'::text, p_departments text[] DEFAULT NULL::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
DECLARE v_result jsonb;
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_from>p_to THEN RAISE EXCEPTION 'Invalid monthly report period'; END IF;
  IF p_scope NOT IN ('designer','all','selected') THEN RAISE EXCEPTION 'Invalid cohort scope'; END IF;
  WITH
  bounds AS MATERIALIZED (
    SELECT p_from::timestamp AT TIME ZONE 'Europe/Minsk' from_ts,
      (p_to+1)::timestamp AT TIME ZONE 'Europe/Minsk' to_ts
  ),
  cohort AS MATERIALIZED (
    SELECT u.id,lower(u.email) email FROM public.ws_users u
    WHERE u.is_active=true AND (
      p_scope='all'
      OR (p_scope='designer' AND EXISTS (
        SELECT 1 FROM public.admin_department_groups g
        WHERE g.department=u.department AND g.group_type='designer'
      ))
      OR (p_scope='selected' AND u.department=ANY(COALESCE(p_departments,ARRAY[]::text[])))
    )
  ),
  actions AS MATERIALIZED (
    SELECT g.sender_id user_id,'gratitude' action
    FROM public.gratitudes g JOIN cohort c ON c.id=g.sender_id CROSS JOIN bounds b
    WHERE g.created_at>=b.from_ts AND g.created_at<b.to_ts
    UNION ALL
    SELECT o.user_id,'shop'
    FROM public.shop_orders o JOIN cohort c ON c.id=o.user_id
    JOIN public.shop_products p ON p.id=o.product_id CROSS JOIN bounds b
    WHERE o.status<>'cancelled' AND p.effect IS NULL
      AND o.created_at>=b.from_ts AND o.created_at<b.to_ts
    UNION ALL
    SELECT s.user_id,'shield'
    FROM public.streak_shield_log s JOIN cohort c ON c.id=s.user_id CROSS JOIN bounds b
    WHERE s.created_at>=b.from_ts AND s.created_at<b.to_ts
  ),
  shield_opportunities AS MATERIALIZED (
    SELECT DISTINCT s.user_id,s.protected_date opportunity_date,s.shield_type source,true saved
    FROM public.streak_shield_log s JOIN cohort c ON c.id=s.user_id
    WHERE s.protected_date BETWEEN p_from AND p_to
  ),
  reset_opportunities AS MATERIALIZED (
    SELECT DISTINCT e.user_id,e.event_date opportunity_date,
      CASE WHEN e.event_type='revit_streak_reset' THEN 'revit' ELSE 'ws' END source,
      false saved
    FROM public.gamification_event_logs e JOIN cohort c ON c.id=e.user_id
    WHERE e.event_date BETWEEN p_from AND p_to
      AND (e.event_type='revit_streak_reset' OR e.event_type LIKE 'streak_reset_%')
  ),
  streak_opportunity_outcomes AS MATERIALIZED (
    SELECT o.user_id,o.opportunity_date,o.source,bool_or(o.saved) saved
    FROM (
      SELECT * FROM shield_opportunities
      UNION ALL
      SELECT * FROM reset_opportunities
    ) o
    GROUP BY o.user_id,o.opportunity_date,o.source
  ),
  statuses AS MATERIALIZED (
    SELECT s.user_id,s.status,s.red_reasons
    FROM public.ws_daily_statuses s JOIN cohort c ON c.id=s.user_id
    WHERE s.date BETWEEN p_from AND p_to
    UNION ALL
    SELECT s.user_id,s.status,s.red_reasons
    FROM public.ws_daily_statuses_baseline s JOIN cohort c ON c.id=s.user_id
    WHERE s.date BETWEEN p_from AND p_to
  ),
  tx AS MATERIALIZED (
    SELECT t.user_id,t.coins
    FROM public.gamification_transactions t JOIN cohort c ON c.id=t.user_id CROSS JOIN bounds b
    WHERE t.created_at>=b.from_ts AND t.created_at<b.to_ts
  )
  SELECT jsonb_build_object(
    'cohort_count',(SELECT count(*) FROM cohort),
    'registered_count',(SELECT count(*) FROM cohort c,bounds b WHERE EXISTS (
      SELECT 1 FROM public.profiles p WHERE lower(p.email)=c.email AND p.created_at<b.to_ts
    )),
    'gamification_active_count',(SELECT count(DISTINCT user_id) FROM actions),
    'gratitude_senders',(SELECT count(DISTINCT user_id) FROM actions WHERE action='gratitude'),
    'shop_buyers',(SELECT count(DISTINCT user_id) FROM actions WHERE action='shop'),
    'shield_users',(SELECT count(DISTINCT user_id) FROM actions WHERE action='shield'),
    'shield_response_users',(SELECT count(DISTINCT user_id) FROM streak_opportunity_outcomes WHERE saved),
    'shield_opportunity_users',(SELECT count(DISTINCT user_id) FROM streak_opportunity_outcomes),
    'shield_saved_opportunities',(SELECT count(*) FROM streak_opportunity_outcomes WHERE saved),
    'shield_total_opportunities',(SELECT count(*) FROM streak_opportunity_outcomes),
    'earned_coins',(SELECT COALESCE(sum(coins) FILTER (WHERE coins>0),0) FROM tx),
    'spent_coins',(SELECT COALESCE(-sum(coins) FILTER (WHERE coins<0),0) FROM tx),
    'green_pct',(SELECT round(100.0*count(*) FILTER (WHERE status='green')/NULLIF(count(*) FILTER (WHERE status IN ('green','red')),0),1) FROM statuses),
    'wrong_status_pct',(SELECT round(100.0*count(*) FILTER (WHERE status='red' AND red_reasons @> '[{"type":"wrong_status_report"}]')/NULLIF(count(*) FILTER (WHERE status IN ('green','red')),0),1) FROM statuses),
    'no_report_pct',(SELECT round(100.0*count(*) FILTER (WHERE status='red' AND red_reasons @> '[{"type":"red_day"}]')/NULLIF(count(*) FILTER (WHERE status IN ('green','red')),0),1) FROM statuses)
  ) INTO v_result;
  RETURN v_result;
END;
$function$;
