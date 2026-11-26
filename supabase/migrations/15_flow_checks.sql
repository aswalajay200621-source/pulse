-- Migration 15: Login Flow Checks (Level 6) with owner-only RLS

CREATE TABLE IF NOT EXISTS public.flow_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  name text NOT NULL,
  login_url text NOT NULL,
  content_type text NOT NULL DEFAULT 'json' CHECK (content_type IN ('json', 'form')),
  email_field text NOT NULL DEFAULT 'email',
  password_field text NOT NULL DEFAULT 'password',
  test_email text NOT NULL,
  encrypted_password text,
  iv text,
  auth_tag text,
  expected_status integer NOT NULL DEFAULT 200,
  expected_text text,
  enabled boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  last_status text CHECK (last_status IN ('ok', 'failing')),
  consecutive_failures integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_flow_checks_app_id ON public.flow_checks(application_id);
CREATE INDEX IF NOT EXISTS idx_flow_checks_user_id ON public.flow_checks(user_id);

ALTER TABLE public.flow_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own flow checks"
  ON public.flow_checks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own flow checks"
  ON public.flow_checks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own flow checks"
  ON public.flow_checks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own flow checks"
  ON public.flow_checks FOR DELETE
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.flow_check_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_check_id uuid NOT NULL REFERENCES public.flow_checks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ok boolean NOT NULL,
  status_code integer,
  duration_ms integer NOT NULL,
  excerpt text,
  checked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_flow_check_results_check_id
  ON public.flow_check_results(flow_check_id, checked_at DESC);

ALTER TABLE public.flow_check_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own flow check results"
  ON public.flow_check_results FOR SELECT
  USING (auth.uid() = user_id);
