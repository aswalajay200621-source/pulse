-- ==============================================================================
-- PULSE – PHASE 10: WEEKLY REPORTS MIGRATION
-- Run this script in the Supabase Dashboard SQL Editor
-- ==============================================================================

create table if not exists public.weekly_reports (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  period_key text not null,
  apps_monitored integer default 0 not null,
  uptime_percentage numeric(5,2),
  avg_response_time integer,
  downtime_incidents integer default 0 not null,
  recovery_events integer default 0 not null,
  new_findings integer default 0 not null,
  resolved_findings integer default 0 not null,
  upcoming_expiries integer default 0 not null,
  recommended_actions jsonb default '[]'::jsonb not null,
  summary_data jsonb default '{}'::jsonb not null,
  email_sent boolean default false not null,
  created_at timestamptz default now() not null,
  constraint uq_weekly_report_user_period unique (user_id, period_key)
);

create index if not exists idx_weekly_reports_user_id on public.weekly_reports(user_id);
create index if not exists idx_weekly_reports_created_at on public.weekly_reports(created_at desc);

alter table public.weekly_reports enable row level security;

drop policy if exists "Users can view own weekly reports" on public.weekly_reports;
create policy "Users can view own weekly reports" on public.weekly_reports
  for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own weekly reports" on public.weekly_reports;
create policy "Users can insert own weekly reports" on public.weekly_reports
  for insert with check (auth.uid() = user_id);
