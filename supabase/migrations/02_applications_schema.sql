-- ==============================================================================
-- PULSE – PHASE 3: DATABASE ARCHITECTURE & APPLICATION MANAGEMENT
-- Run this script in the Supabase Dashboard SQL Editor
-- ==============================================================================

-- 1. Ensure PROFILES table has required structure
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade not null primary key,
  full_name text,
  email text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 2. Create APPLICATIONS table
create table if not exists public.applications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  url text not null,
  description text,
  github_repository_url text,
  monitoring_enabled boolean default true not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Index for fast user application queries
create index if not exists idx_applications_user_id on public.applications(user_id);
create index if not exists idx_applications_monitoring_enabled on public.applications(monitoring_enabled);

-- Enforce maximum of 3 applications per user on the database level
create or replace function public.check_user_application_limit()
returns trigger
language plpgsql
security definer
as $$
declare
  app_count integer;
begin
  select count(*) into app_count
  from public.applications
  where user_id = new.user_id;

  if app_count >= 3 then
    raise exception 'Application limit reached: A maximum of 3 applications are allowed per account.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trigger_enforce_app_limit on public.applications;
create trigger trigger_enforce_app_limit
  before insert on public.applications
  for each row execute function public.check_user_application_limit();

-- 3. Create MONITORING_CHECKS table
create table if not exists public.monitoring_checks (
  id uuid default gen_random_uuid() primary key,
  application_id uuid references public.applications(id) on delete cascade not null,
  status text not null check (status in ('online', 'degraded', 'down', 'maintenance')),
  status_code integer,
  response_time integer, -- latency in milliseconds
  checked_at timestamptz default now() not null
);

create index if not exists idx_monitoring_checks_application_id on public.monitoring_checks(application_id);
create index if not exists idx_monitoring_checks_checked_at on public.monitoring_checks(checked_at desc);

-- 4. Create SECURITY_SCANS table
create table if not exists public.security_scans (
  id uuid default gen_random_uuid() primary key,
  application_id uuid references public.applications(id) on delete cascade not null,
  scan_status text not null check (scan_status in ('completed', 'in_progress', 'failed')),
  scanned_at timestamptz default now() not null
);

create index if not exists idx_security_scans_application_id on public.security_scans(application_id);
create index if not exists idx_security_scans_scanned_at on public.security_scans(scanned_at desc);

-- 5. Create SECURITY_FINDINGS table
create table if not exists public.security_findings (
  id uuid default gen_random_uuid() primary key,
  scan_id uuid references public.security_scans(id) on delete cascade not null,
  application_id uuid references public.applications(id) on delete cascade not null,
  category text not null,
  severity text not null check (severity in ('critical', 'high', 'medium', 'low')),
  title text not null,
  description text not null,
  affected_resource text,
  created_at timestamptz default now() not null
);

create index if not exists idx_security_findings_app on public.security_findings(application_id);
create index if not exists idx_security_findings_scan on public.security_findings(scan_id);
create index if not exists idx_security_findings_severity on public.security_findings(severity);

-- 6. Create ALERTS table
create table if not exists public.alerts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  application_id uuid references public.applications(id) on delete cascade not null,
  severity text not null check (severity in ('critical', 'high', 'medium', 'low')),
  title text not null,
  description text not null,
  is_read boolean default false not null,
  created_at timestamptz default now() not null
);

create index if not exists idx_alerts_user_id on public.alerts(user_id);
create index if not exists idx_alerts_app_id on public.alerts(application_id);
create index if not exists idx_alerts_is_read on public.alerts(is_read);
create index if not exists idx_alerts_created_at on public.alerts(created_at desc);

-- 7. Create EXPIRY_RECORDS table
create table if not exists public.expiry_records (
  id uuid default gen_random_uuid() primary key,
  application_id uuid references public.applications(id) on delete cascade not null,
  expiry_type text not null check (expiry_type in ('ssl_certificate', 'domain', 'api_key', 'token')),
  expiry_date timestamptz not null,
  created_at timestamptz default now() not null
);

create index if not exists idx_expiry_records_application_id on public.expiry_records(application_id);
create index if not exists idx_expiry_records_date on public.expiry_records(expiry_date asc);

-- 8. Create NOTIFICATION_PREFERENCES table
create table if not exists public.notification_preferences (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null unique,
  email_enabled boolean default true not null,
  weekly_report_enabled boolean default true not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES — ENFORCE COMPLETE DATA ISOLATION
-- ==============================================================================

alter table public.profiles enable row level security;
alter table public.applications enable row level security;
alter table public.monitoring_checks enable row level security;
alter table public.security_scans enable row level security;
alter table public.security_findings enable row level security;
alter table public.alerts enable row level security;
alter table public.expiry_records enable row level security;
alter table public.notification_preferences enable row level security;

-- PROFILES
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

-- APPLICATIONS
drop policy if exists "Users can view own applications" on public.applications;
create policy "Users can view own applications" on public.applications
  for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own applications" on public.applications;
create policy "Users can insert own applications" on public.applications
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own applications" on public.applications;
create policy "Users can update own applications" on public.applications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete own applications" on public.applications;
create policy "Users can delete own applications" on public.applications
  for delete using (auth.uid() = user_id);

-- MONITORING_CHECKS (Inherits access through applications.user_id)
drop policy if exists "Users can view own application checks" on public.monitoring_checks;
create policy "Users can view own application checks" on public.monitoring_checks
  for select using (
    exists (
      select 1 from public.applications a
      where a.id = monitoring_checks.application_id
      and a.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert own application checks" on public.monitoring_checks;
create policy "Users can insert own application checks" on public.monitoring_checks
  for insert with check (
    exists (
      select 1 from public.applications a
      where a.id = monitoring_checks.application_id
      and a.user_id = auth.uid()
    )
  );

-- SECURITY_SCANS
drop policy if exists "Users can view own security scans" on public.security_scans;
create policy "Users can view own security scans" on public.security_scans
  for select using (
    exists (
      select 1 from public.applications a
      where a.id = security_scans.application_id
      and a.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert own security scans" on public.security_scans;
create policy "Users can insert own security scans" on public.security_scans
  for insert with check (
    exists (
      select 1 from public.applications a
      where a.id = security_scans.application_id
      and a.user_id = auth.uid()
    )
  );

-- SECURITY_FINDINGS
drop policy if exists "Users can view own security findings" on public.security_findings;
create policy "Users can view own security findings" on public.security_findings
  for select using (
    exists (
      select 1 from public.applications a
      where a.id = security_findings.application_id
      and a.user_id = auth.uid()
    )
  );

-- ALERTS
drop policy if exists "Users can view own alerts" on public.alerts;
create policy "Users can view own alerts" on public.alerts
  for select using (auth.uid() = user_id);

drop policy if exists "Users can update own alerts" on public.alerts;
create policy "Users can update own alerts" on public.alerts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete own alerts" on public.alerts;
create policy "Users can delete own alerts" on public.alerts
  for delete using (auth.uid() = user_id);

-- EXPIRY_RECORDS
drop policy if exists "Users can view own expiry records" on public.expiry_records;
create policy "Users can view own expiry records" on public.expiry_records
  for select using (
    exists (
      select 1 from public.applications a
      where a.id = expiry_records.application_id
      and a.user_id = auth.uid()
    )
  );

-- NOTIFICATION_PREFERENCES
drop policy if exists "Users can view own notification preferences" on public.notification_preferences;
create policy "Users can view own notification preferences" on public.notification_preferences
  for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own notification preferences" on public.notification_preferences;
create policy "Users can insert own notification preferences" on public.notification_preferences
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own notification preferences" on public.notification_preferences;
create policy "Users can update own notification preferences" on public.notification_preferences
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
