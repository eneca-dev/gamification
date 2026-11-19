-- HR/admin correction drafts, previews, and execution audit.
-- This table is intentionally append-friendly: corrections record intent,
-- snapshots, planned steps, and future applied results without mutating the
-- original gamification history.

CREATE TABLE IF NOT EXISTS public.admin_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correction_type text NOT NULL CHECK (correction_type IN (
    'manual_balance_adjustment',
    'reverse_transaction',
    'add_absence',
    'remove_absence',
    'change_absence_type',
    'fix_day_off_request',
    'fix_revit_launch',
    'recalculate_ws_day',
    'recalculate_revit_day',
    'cancel_shop_order',
    'recalculate_user_period'
  )),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',
    'previewed',
    'running',
    'applied',
    'failed',
    'cancelled'
  )),
  admin_user_id uuid REFERENCES public.ws_users(id),
  target_user_id uuid NOT NULL REFERENCES public.ws_users(id),
  reason text NOT NULL CHECK (char_length(trim(reason)) > 0),
  input_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  preview_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  planned_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  executed_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_event_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  created_transaction_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_corrections_target_created
  ON public.admin_corrections (target_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_corrections_status_created
  ON public.admin_corrections (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_corrections_admin_created
  ON public.admin_corrections (admin_user_id, created_at DESC);

ALTER TABLE public.admin_corrections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins can read admin_corrections" ON public.admin_corrections;
CREATE POLICY "admins can read admin_corrections"
  ON public.admin_corrections
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.ws_users u
      WHERE u.user_id = (SELECT auth.uid())
        AND u.is_admin = true
    )
  );

DROP POLICY IF EXISTS "admins can insert admin_corrections" ON public.admin_corrections;
CREATE POLICY "admins can insert admin_corrections"
  ON public.admin_corrections
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.ws_users u
      WHERE u.user_id = (SELECT auth.uid())
        AND u.is_admin = true
    )
  );

DROP POLICY IF EXISTS "admins can update admin_corrections" ON public.admin_corrections;
CREATE POLICY "admins can update admin_corrections"
  ON public.admin_corrections
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.ws_users u
      WHERE u.user_id = (SELECT auth.uid())
        AND u.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.ws_users u
      WHERE u.user_id = (SELECT auth.uid())
        AND u.is_admin = true
    )
  );
