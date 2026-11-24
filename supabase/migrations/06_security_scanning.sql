-- ==============================================================================
-- PULSE – PHASE 8: GITHUB SECURITY SCANNING ENGINE MIGRATION
-- Run this script in the Supabase Dashboard SQL Editor
-- ==============================================================================

-- 1. Extend SECURITY_SCANS to track full scan lifecycle
alter table public.security_scans
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists repository_id uuid references public.github_repositories(id) on delete set null,
  add column if not exists scan_type text default 'manual' check (scan_type in ('manual','scheduled','triggered')),
  add column if not exists duration_ms integer,
  add column if not exists findings_count integer default 0,
  add column if not exists critical_count integer default 0,
  add column if not exists high_count integer default 0,
  add column if not exists medium_count integer default 0,
  add column if not exists low_count integer default 0,
  add column if not exists error_message text,
  add column if not exists idempotency_key text;

create unique index if not exists uq_security_scan_idempotency
  on public.security_scans(idempotency_key)
  where (idempotency_key is not null);

create index if not exists idx_security_scans_user_id on public.security_scans(user_id);
create index if not exists idx_security_scans_repo_id on public.security_scans(repository_id);

-- 2. Extend SECURITY_FINDINGS to track finding lifecycle and deduplication
alter table public.security_findings
  add column if not exists scan_id_new uuid references public.security_scans(id) on delete cascade,
  add column if not exists repository_id uuid references public.github_repositories(id) on delete set null,
  add column if not exists source text default 'header_check' check (source in ('secret_scan','dependency_scan','header_check')),
  add column if not exists finding_key text,
  add column if not exists status text default 'open' check (status in ('open','resolved','ignored')),
  add column if not exists ignore_reason text,
  add column if not exists first_seen_at timestamptz default now(),
  add column if not exists resolved_at timestamptz,
  add column if not exists file_path text,
  add column if not exists line_number integer,
  add column if not exists package_name text,
  add column if not exists installed_version text,
  add column if not exists fixed_version text,
  add column if not exists vuln_id text,
  add column if not exists masked_secret text,
  add column if not exists rule_id text,
  add column if not exists remediation text,
  add column if not exists is_new boolean default true,
  add column if not exists is_recurring boolean default false;

-- Deduplicate: same finding key within same app (prevents duplicates across repeated scans)
create unique index if not exists uq_finding_key_per_app
  on public.security_findings(application_id, finding_key)
  where (finding_key is not null);

create index if not exists idx_security_findings_status on public.security_findings(status);
create index if not exists idx_security_findings_source on public.security_findings(source);
create index if not exists idx_security_findings_repo on public.security_findings(repository_id);
create index if not exists idx_security_findings_key on public.security_findings(finding_key);

-- 3. RLS: grant users INSERT on security findings and scans via service role (server-side only)
-- Users can view their own; service role (admin client) handles inserts
drop policy if exists "Users can update own findings status" on public.security_findings;
create policy "Users can update own findings status" on public.security_findings
  for update using (
    exists (
      select 1 from public.applications a
      where a.id = security_findings.application_id
      and a.user_id = auth.uid()
    )
  );
