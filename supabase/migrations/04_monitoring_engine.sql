-- ==============================================================================
-- PULSE – PHASE 5: REAL UPTIME & PERFORMANCE MONITORING MIGRATION
-- Run this script in the Supabase Dashboard SQL Editor
-- ==============================================================================

-- 1. Extend MONITORING_CHECKS with error_message, is_slow, and job_id
alter table public.monitoring_checks
  add column if not exists error_message text,
  add column if not exists is_slow boolean default false not null,
  add column if not exists job_id uuid;

-- 2. Create MONITORING_INCIDENTS table (3 consecutive failures & recovery tracking)
create table if not exists public.monitoring_incidents (
  id uuid default gen_random_uuid() primary key,
  application_id uuid references public.applications(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  status text not null check (status in ('open', 'resolved')) default 'open',
  consecutive_failures integer default 3 not null,
  started_at timestamptz default now() not null,
  resolved_at timestamptz,
  last_error text,
  created_at timestamptz default now() not null
);

create index if not exists idx_monitoring_incidents_app_id on public.monitoring_incidents(application_id);
create index if not exists idx_monitoring_incidents_user_id on public.monitoring_incidents(user_id);
create index if not exists idx_monitoring_incidents_status on public.monitoring_incidents(status);

-- Prevent duplicate open incidents for the same application
create unique index if not exists uq_open_incident_per_app
  on public.monitoring_incidents(application_id)
  where (status = 'open');

-- 3. Create MONITORING_JOBS table (Scheduler tracking & idempotency)
create table if not exists public.monitoring_jobs (
  id uuid default gen_random_uuid() primary key,
  idempotency_key text unique,
  status text not null check (status in ('running', 'completed', 'failed')) default 'running',
  total_apps integer default 0 not null,
  succeeded_count integer default 0 not null,
  failed_count integer default 0 not null,
  error_message text,
  started_at timestamptz default now() not null,
  completed_at timestamptz
);

create index if not exists idx_monitoring_jobs_started_at on public.monitoring_jobs(started_at desc);
create index if not exists idx_monitoring_jobs_idempotency on public.monitoring_jobs(idempotency_key);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

alter table public.monitoring_incidents enable row level security;
alter table public.monitoring_jobs enable row level security;

drop policy if exists "Users can view own monitoring incidents" on public.monitoring_incidents;
create policy "Users can view own monitoring incidents" on public.monitoring_incidents
  for select using (auth.uid() = user_id);

drop policy if exists "Service can manage monitoring incidents" on public.monitoring_incidents;
create policy "Service can manage monitoring incidents" on public.monitoring_incidents
  for all using (true) with check (true);

drop policy if exists "Service can manage monitoring jobs" on public.monitoring_jobs;
create policy "Service can manage monitoring jobs" on public.monitoring_jobs
  for all using (true) with check (true);
