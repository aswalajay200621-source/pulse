-- ==============================================================================
-- PULSE – DEEP SCAN FEATURE MIGRATION
-- Run this script in the Supabase Dashboard SQL Editor
-- ==============================================================================

-- 1. Allow 'deep_scan' in security_findings.source
alter table public.security_findings
  drop constraint if exists security_findings_source_check;

alter table public.security_findings
  add constraint security_findings_source_check
  check (source in ('secret_scan', 'dependency_scan', 'header_check', 'deep_scan'));

-- 2. Add optional weekly deep scan toggle to applications
alter table public.applications
  add column if not exists weekly_deep_scan_enabled boolean default false not null;

-- 3. Create DOMAIN_VERIFICATIONS table
create table if not exists public.domain_verifications (
  id uuid default gen_random_uuid() primary key,
  application_id uuid references public.applications(id) on delete cascade not null unique,
  user_id uuid references auth.users(id) on delete cascade not null,
  token text not null,
  method text check (method in ('well_known', 'dns_txt')),
  verified_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz default now() not null
);

create index if not exists idx_domain_verifications_app_id on public.domain_verifications(application_id);
create index if not exists idx_domain_verifications_user_id on public.domain_verifications(user_id);

-- 4. Create SCAN_CONSENTS table
create table if not exists public.scan_consents (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  application_id uuid references public.applications(id) on delete cascade not null,
  consented_at timestamptz default now() not null,
  constraint uq_scan_consent_user_app unique (user_id, application_id)
);

-- 5. Create DEEP_SCANS audit log table
create table if not exists public.deep_scans (
  id uuid default gen_random_uuid() primary key,
  application_id uuid references public.applications(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  status text not null check (status in ('running', 'completed', 'failed')) default 'running',
  request_count integer default 0 not null,
  findings_count integer default 0 not null,
  critical_count integer default 0 not null,
  high_count integer default 0 not null,
  medium_count integer default 0 not null,
  low_count integer default 0 not null,
  error_message text,
  started_at timestamptz default now() not null,
  completed_at timestamptz
);

create index if not exists idx_deep_scans_app_id on public.deep_scans(application_id);
create index if not exists idx_deep_scans_started_at on public.deep_scans(started_at desc);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES (Owner-only)
-- ==============================================================================

alter table public.domain_verifications enable row level security;
alter table public.scan_consents enable row level security;
alter table public.deep_scans enable row level security;

drop policy if exists "Owners can manage own domain verifications" on public.domain_verifications;
create policy "Owners can manage own domain verifications" on public.domain_verifications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Owners can manage own scan consents" on public.scan_consents;
create policy "Owners can manage own scan consents" on public.scan_consents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Owners can view own deep scans" on public.deep_scans;
create policy "Owners can view own deep scans" on public.deep_scans
  for select using (auth.uid() = user_id);

drop policy if exists "Owners can insert own deep scans" on public.deep_scans;
create policy "Owners can insert own deep scans" on public.deep_scans
  for insert with check (auth.uid() = user_id);

drop policy if exists "Owners can update own deep scans" on public.deep_scans;
create policy "Owners can update own deep scans" on public.deep_scans
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
