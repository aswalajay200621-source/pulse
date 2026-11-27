-- 18_phase1_uptime_engine.sql
-- Adds Heartbeat monitors, Maintenance windows, and 5-step response time breakdown columns.

CREATE TABLE IF NOT EXISTS public.heartbeat_monitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  expected_interval_minutes INTEGER NOT NULL DEFAULT 5,
  grace_minutes INTEGER NOT NULL DEFAULT 2,
  last_ping_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'waiting',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.heartbeat_monitors ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'heartbeat_monitors' AND policyname = 'Users can manage own heartbeats'
  ) THEN
    CREATE POLICY "Users can manage own heartbeats" ON public.heartbeat_monitors
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.maintenance_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.maintenance_windows ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'maintenance_windows' AND policyname = 'Users can manage own maintenance windows'
  ) THEN
    CREATE POLICY "Users can manage own maintenance windows" ON public.maintenance_windows
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

ALTER TABLE public.monitoring_checks
  ADD COLUMN IF NOT EXISTS ttfb_ms INTEGER,
  ADD COLUMN IF NOT EXISTS download_ms INTEGER,
  ADD COLUMN IF NOT EXISTS check_region TEXT DEFAULT 'from one location';

NOTIFY pgrst, 'reload schema';
