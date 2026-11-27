-- 19_phase3_incidents_alerts.sql
-- Adds incident timeline stages, acknowledgement, owner notes, failure response snippets, and optional webhook/escalation fields.

ALTER TABLE public.monitoring_incidents
  ADD COLUMN IF NOT EXISTS timeline_stage TEXT NOT NULL DEFAULT 'started',
  ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS owner_notes TEXT;

ALTER TABLE public.monitoring_checks
  ADD COLUMN IF NOT EXISTS response_snippet TEXT;

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS webhook_url TEXT,
  ADD COLUMN IF NOT EXISTS escalation_email TEXT;

NOTIFY pgrst, 'reload schema';
