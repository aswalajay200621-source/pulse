-- ==============================================================================
-- PULSE – CODE HEALTH MIGRATION (Feature 1: Error Reporting, Feature 2: Health Check, Feature 3: GitHub Build Status)
-- Run this script in the Supabase Dashboard SQL Editor
-- ==============================================================================

-- ============================================================
-- FEATURE 1: ERROR REPORTING
-- ============================================================

-- 1a. ingest_keys — API keys for error ingest (store only hash)
create table if not exists public.ingest_keys (
  id uuid default gen_random_uuid() primary key,
  application_id uuid references public.applications(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  key_hash text not null unique,          -- SHA-256 hex of the raw key
  key_prefix text not null,               -- first 6 chars of raw key (display only)
  allowed_origins text[] default '{}'::text[] not null,
  created_at timestamptz default now() not null,
  revoked_at timestamptz
);

create index if not exists idx_ingest_keys_app on public.ingest_keys(application_id);
create index if not exists idx_ingest_keys_user on public.ingest_keys(user_id);
create index if not exists idx_ingest_keys_hash on public.ingest_keys(key_hash);

alter table public.ingest_keys enable row level security;

drop policy if exists "Owner can manage own ingest keys" on public.ingest_keys;
create policy "Owner can manage own ingest keys" on public.ingest_keys
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 1b. error_groups — deduplicated error fingerprints
create table if not exists public.error_groups (
  id uuid default gen_random_uuid() primary key,
  application_id uuid references public.applications(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  fingerprint text not null,
  title text not null,                   -- truncated error message
  first_seen timestamptz default now() not null,
  last_seen timestamptz default now() not null,
  count_total integer default 1 not null,
  count_24h integer default 1 not null,
  status text not null check (status in ('open', 'resolved', 'ignored')) default 'open',
  last_route text,
  severity text not null check (severity in ('critical', 'high', 'medium', 'low')) default 'medium',
  -- alert dedup: last time we sent a "new group" alert
  alerted_new_at timestamptz,
  -- alert dedup: last threshold crossed (json: {"10": "2024-...", "100": "2024-..."})
  alerted_thresholds jsonb default '{}'::jsonb not null,
  constraint uq_error_group_app_fingerprint unique (application_id, fingerprint)
);

create index if not exists idx_error_groups_app on public.error_groups(application_id);
create index if not exists idx_error_groups_user on public.error_groups(user_id);
create index if not exists idx_error_groups_fp on public.error_groups(fingerprint);
create index if not exists idx_error_groups_status on public.error_groups(status);

alter table public.error_groups enable row level security;

drop policy if exists "Owner can view own error groups" on public.error_groups;
create policy "Owner can view own error groups" on public.error_groups
  for select using (auth.uid() = user_id);

drop policy if exists "Owner can update own error groups" on public.error_groups;
create policy "Owner can update own error groups" on public.error_groups
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Service role inserts (ingest endpoint uses admin client)
drop policy if exists "Service role can insert error groups" on public.error_groups;
create policy "Service role can insert error groups" on public.error_groups
  for insert with check (true);

-- 1c. error_events — individual error occurrences (deleted after 30 days by cleanup job)
create table if not exists public.error_events (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references public.error_groups(id) on delete cascade not null,
  application_id uuid references public.applications(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  occurred_at timestamptz default now() not null,
  route text,
  user_agent_family text,               -- browser family only, e.g. "Chrome"
  release text,
  stack_excerpt text                     -- first 15 lines, scrubbed
);

create index if not exists idx_error_events_group on public.error_events(group_id);
create index if not exists idx_error_events_app on public.error_events(application_id);
create index if not exists idx_error_events_occurred on public.error_events(occurred_at);

alter table public.error_events enable row level security;

drop policy if exists "Owner can view own error events" on public.error_events;
create policy "Owner can view own error events" on public.error_events
  for select using (auth.uid() = user_id);

drop policy if exists "Service role can insert error events" on public.error_events;
create policy "Service role can insert error events" on public.error_events
  for insert with check (true);

-- 1d. error_rate_limits — sliding window counters
create table if not exists public.error_rate_limits (
  id uuid default gen_random_uuid() primary key,
  key_id uuid references public.ingest_keys(id) on delete cascade not null,
  window_minute timestamptz not null,   -- truncated to minute
  count integer default 0 not null,
  constraint uq_rate_limit_key_window unique (key_id, window_minute)
);

create index if not exists idx_rate_limits_key_window on public.error_rate_limits(key_id, window_minute);
alter table public.error_rate_limits enable row level security;

drop policy if exists "Service role only rate limits" on public.error_rate_limits;
create policy "Service role only rate limits" on public.error_rate_limits
  for all using (true) with check (true);

-- ============================================================
-- FEATURE 2: HEALTH-CHECK ENDPOINT SUPPORT
-- ============================================================

-- Add health_check_path to applications
alter table public.applications
  add column if not exists health_check_path text,
  add column if not exists health_check_enabled boolean default false not null;

-- health_check_results — separate from uptime checks
create table if not exists public.health_check_results (
  id uuid default gen_random_uuid() primary key,
  application_id uuid references public.applications(id) on delete cascade not null,
  status text not null check (status in ('healthy', 'unhealthy', 'timeout', 'error')),
  status_code integer,
  response_excerpt text,              -- truncated, secrets scrubbed
  error_message text,
  checked_at timestamptz default now() not null
);

create index if not exists idx_hc_results_app on public.health_check_results(application_id);
create index if not exists idx_hc_results_at on public.health_check_results(checked_at);

alter table public.health_check_results enable row level security;

drop policy if exists "Owner can view own health check results" on public.health_check_results;
create policy "Owner can view own health check results" on public.health_check_results
  for select using (
    exists (
      select 1 from public.applications a
      where a.id = health_check_results.application_id
      and a.user_id = auth.uid()
    )
  );

drop policy if exists "Service role can insert health check results" on public.health_check_results;
create policy "Service role can insert health check results" on public.health_check_results
  for insert with check (true);

-- health_check_incidents — same 3-consecutive-failure rule
create table if not exists public.health_check_incidents (
  id uuid default gen_random_uuid() primary key,
  application_id uuid references public.applications(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  status text not null check (status in ('open', 'resolved')) default 'open',
  consecutive_failures integer default 3 not null,
  last_error text,
  started_at timestamptz default now() not null,
  resolved_at timestamptz
);

create index if not exists idx_hc_incidents_app on public.health_check_incidents(application_id);
alter table public.health_check_incidents enable row level security;

drop policy if exists "Owner can view own hc incidents" on public.health_check_incidents;
create policy "Owner can view own hc incidents" on public.health_check_incidents
  for select using (auth.uid() = user_id);

drop policy if exists "Service role can manage hc incidents" on public.health_check_incidents;
create policy "Service role can manage hc incidents" on public.health_check_incidents
  for all using (true) with check (true);

-- ============================================================
-- FEATURE 3: GITHUB BUILD AND DEPLOY STATUS
-- ============================================================

create table if not exists public.repo_status (
  id uuid default gen_random_uuid() primary key,
  application_id uuid references public.applications(id) on delete cascade not null unique,
  user_id uuid references auth.users(id) on delete cascade not null,
  repository_full_name text,
  last_commit_sha text,                  -- short 7-char SHA
  last_run_conclusion text,              -- success/failure/cancelled/none/skipped/timed_out
  last_run_url text,
  last_deploy_state text,               -- success/failure/error/inactive/pending/in_progress/queued
  last_deploy_url text,
  tests_present boolean default false not null,
  build_alerted_at timestamptz,          -- dedup: last build-failed alert
  deploy_alerted_at timestamptz,         -- dedup: last deploy-failed alert
  no_tests_alerted_at timestamptz,       -- dedup: last no-tests alert
  checked_at timestamptz default now() not null
);

create index if not exists idx_repo_status_app on public.repo_status(application_id);
create index if not exists idx_repo_status_user on public.repo_status(user_id);

alter table public.repo_status enable row level security;

drop policy if exists "Owner can view own repo status" on public.repo_status;
create policy "Owner can view own repo status" on public.repo_status
  for select using (auth.uid() = user_id);

drop policy if exists "Service role can manage repo status" on public.repo_status;
create policy "Service role can manage repo status" on public.repo_status
  for all using (true) with check (true);
