-- ==============================================================================
-- PULSE – DAILY HEALTH SCORE SNAPSHOTS MIGRATION
-- Run this script in the Supabase Dashboard SQL Editor
-- ==============================================================================

create table if not exists public.health_score_snapshots (
  id uuid default gen_random_uuid() primary key,
  application_id uuid references public.applications(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  score integer not null check (score >= 0 and score <= 100),
  snapshot_date date not null default current_date,
  created_at timestamptz default now() not null,
  constraint uq_health_score_app_date unique (application_id, snapshot_date)
);

create index if not exists idx_health_score_app_date
  on public.health_score_snapshots(application_id, snapshot_date desc);

alter table public.health_score_snapshots enable row level security;

drop policy if exists "Owner can view own health score snapshots" on public.health_score_snapshots;
create policy "Owner can view own health score snapshots" on public.health_score_snapshots
  for select using (auth.uid() = user_id);

drop policy if exists "Service role can manage health score snapshots" on public.health_score_snapshots;
create policy "Service role can manage health score snapshots" on public.health_score_snapshots
  for all using (true) with check (true);
