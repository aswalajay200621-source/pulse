-- 17_uptimerobot_monitoring.sql
-- Adds UptimeRobot-style monitor types, keyword rules, full health URL, check_type, and ensures status_pages exists.

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS website_check_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS health_check_url TEXT,
  ADD COLUMN IF NOT EXISTS keyword_check_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS keyword_value TEXT,
  ADD COLUMN IF NOT EXISTS keyword_mode TEXT NOT NULL DEFAULT 'contains',
  ADD COLUMN IF NOT EXISTS ssl_check_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS domain_check_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS check_interval_minutes INTEGER NOT NULL DEFAULT 5;

ALTER TABLE public.monitoring_checks
  ADD COLUMN IF NOT EXISTS check_type TEXT NOT NULL DEFAULT 'website';

-- Ensure public.status_pages exists
CREATE TABLE IF NOT EXISTS public.status_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  is_public BOOLEAN NOT NULL DEFAULT false,
  title TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.status_pages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'status_pages' AND policyname = 'Users can manage own status pages'
  ) THEN
    CREATE POLICY "Users can manage own status pages" ON public.status_pages
      FOR ALL USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'status_pages' AND policyname = 'Public can view enabled status pages'
  ) THEN
    CREATE POLICY "Public can view enabled status pages" ON public.status_pages
      FOR SELECT USING (is_public = true);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
