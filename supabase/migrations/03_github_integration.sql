-- ==============================================================================
-- PULSE – PHASE 4: GITHUB APP INTEGRATION MIGRATION
-- Run this script in the Supabase Dashboard SQL Editor
-- ==============================================================================

-- 1. Create GITHUB_INSTALLATIONS table
create table if not exists public.github_installations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  installation_id bigint unique not null,
  account_login text not null,
  account_id bigint not null,
  account_type text default 'User' not null,
  account_avatar_url text,
  target_type text,
  permissions jsonb,
  installed_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists idx_github_installations_user_id on public.github_installations(user_id);
create index if not exists idx_github_installations_inst_id on public.github_installations(installation_id);

-- 2. Create GITHUB_REPOSITORIES table
create table if not exists public.github_repositories (
  id uuid default gen_random_uuid() primary key,
  installation_id bigint not null references public.github_installations(installation_id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade not null,
  repo_id bigint not null,
  name text not null,
  full_name text not null,
  owner_login text not null,
  default_branch text default 'main' not null,
  is_private boolean default false not null,
  html_url text not null,
  application_id uuid references public.applications(id) on delete set null,
  last_synchronized_at timestamptz default now() not null,
  created_at timestamptz default now() not null,
  constraint uq_installation_repo unique (installation_id, repo_id)
);

create index if not exists idx_github_repositories_user_id on public.github_repositories(user_id);
create index if not exists idx_github_repositories_app_id on public.github_repositories(application_id);
create index if not exists idx_github_repositories_inst_id on public.github_repositories(installation_id);

-- 3. Create GITHUB_WEBHOOK_EVENTS table (Idempotency and Audit Log)
create table if not exists public.github_webhook_events (
  id uuid default gen_random_uuid() primary key,
  delivery_id text unique not null,
  event_type text not null,
  action text,
  installation_id bigint,
  payload jsonb,
  processed boolean default false not null,
  error text,
  created_at timestamptz default now() not null
);

create index if not exists idx_github_webhook_events_delivery on public.github_webhook_events(delivery_id);
create index if not exists idx_github_webhook_events_type on public.github_webhook_events(event_type);
create index if not exists idx_github_webhook_events_inst on public.github_webhook_events(installation_id);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES — ENFORCE COMPLETE DATA ISOLATION
-- ==============================================================================

alter table public.github_installations enable row level security;
alter table public.github_repositories enable row level security;
alter table public.github_webhook_events enable row level security;

-- GITHUB_INSTALLATIONS
drop policy if exists "Users can view own github installations" on public.github_installations;
create policy "Users can view own github installations" on public.github_installations
  for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own github installations" on public.github_installations;
create policy "Users can insert own github installations" on public.github_installations
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own github installations" on public.github_installations;
create policy "Users can update own github installations" on public.github_installations
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete own github installations" on public.github_installations;
create policy "Users can delete own github installations" on public.github_installations
  for delete using (auth.uid() = user_id);

-- GITHUB_REPOSITORIES
drop policy if exists "Users can view own github repositories" on public.github_repositories;
create policy "Users can view own github repositories" on public.github_repositories
  for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own github repositories" on public.github_repositories;
create policy "Users can insert own github repositories" on public.github_repositories
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own github repositories" on public.github_repositories;
create policy "Users can update own github repositories" on public.github_repositories
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete own github repositories" on public.github_repositories;
create policy "Users can delete own github repositories" on public.github_repositories
  for delete using (auth.uid() = user_id);

-- GITHUB_WEBHOOK_EVENTS (Server only, no public select)
drop policy if exists "Service can manage webhook events" on public.github_webhook_events;
create policy "Service can manage webhook events" on public.github_webhook_events
  for all using (true) with check (true);
