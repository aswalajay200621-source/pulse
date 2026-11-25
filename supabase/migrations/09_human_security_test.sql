-- ==============================================================================
-- PULSE – HUMAN SECURITY TEST (EXPERTS) MIGRATION
-- Run this script in the Supabase Dashboard SQL Editor
-- ==============================================================================

-- 1. TESTER_PROFILES
create table if not exists public.tester_profiles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null unique,
  display_name text not null,
  skill_level text not null check (skill_level in ('beginner', 'intermediate', 'advanced')) default 'beginner',
  focus_areas text[] default '{}'::text[] not null,
  proof_url text,
  status text not null check (status in ('pending', 'approved', 'rejected')) default 'pending',
  created_at timestamptz default now() not null
);

-- 2. TEST_REQUESTS
create table if not exists public.test_requests (
  id uuid default gen_random_uuid() primary key,
  application_id uuid references public.applications(id) on delete cascade not null,
  owner_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  scope_urls text[] default '{}'::text[] not null,
  out_of_scope text default '' not null,
  focus_areas text[] default '{}'::text[] not null,
  test_accounts_note text default '' not null,
  rules_text text default '' not null,
  reward_low integer default 0 not null,
  reward_medium integer default 0 not null,
  reward_high integer default 0 not null,
  reward_critical integer default 0 not null,
  safe_harbor_accepted boolean default false not null,
  status text not null check (status in ('draft', 'open', 'in_progress', 'paused', 'closed')) default 'draft',
  ownership_verified_at timestamptz,
  created_at timestamptz default now() not null
);

-- 3. TEST_INVITES
create table if not exists public.test_invites (
  id uuid default gen_random_uuid() primary key,
  request_id uuid references public.test_requests(id) on delete cascade not null,
  tester_id uuid references auth.users(id) on delete cascade not null,
  status text not null check (status in ('invited', 'accepted', 'declined')) default 'invited',
  created_at timestamptz default now() not null,
  constraint uq_test_invite_request_tester unique (request_id, tester_id)
);

-- 4. TEST_REPORTS
create table if not exists public.test_reports (
  id uuid default gen_random_uuid() primary key,
  request_id uuid references public.test_requests(id) on delete cascade not null,
  reporter_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  severity_claimed text not null check (severity_claimed in ('low', 'medium', 'high', 'critical')),
  affected_url text not null,
  steps_to_reproduce text not null,
  impact text not null,
  proof_text text default '' not null,
  status text not null check (status in ('new', 'triaged', 'valid', 'duplicate', 'invalid', 'fixed', 'paid')) default 'new',
  severity_final text check (severity_final in ('low', 'medium', 'high', 'critical')),
  reward_amount integer default 0 not null,
  payment_reference text,
  reward_confirmed_at timestamptz,
  duplicate_of uuid references public.test_reports(id) on delete set null,
  owner_note text,
  retest_status text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 5. REPORT_MESSAGES
create table if not exists public.report_messages (
  id uuid default gen_random_uuid() primary key,
  report_id uuid references public.test_reports(id) on delete cascade not null,
  sender_id uuid references auth.users(id) on delete cascade not null,
  body text not null,
  created_at timestamptz default now() not null
);

-- Indexes
create index if not exists idx_test_requests_owner on public.test_requests(owner_id);
create index if not exists idx_test_requests_app on public.test_requests(application_id);
create index if not exists idx_test_invites_tester on public.test_invites(tester_id);
create index if not exists idx_test_reports_request on public.test_reports(request_id);
create index if not exists idx_test_reports_reporter on public.test_reports(reporter_id);
create index if not exists idx_report_messages_report on public.report_messages(report_id);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ==============================================================================
alter table public.tester_profiles enable row level security;
alter table public.test_requests enable row level security;
alter table public.test_invites enable row level security;
alter table public.test_reports enable row level security;
alter table public.report_messages enable row level security;

-- TESTER_PROFILES
drop policy if exists "Users can view own tester profile" on public.tester_profiles;
create policy "Users can view own tester profile" on public.tester_profiles
  for select using (auth.uid() = user_id or status = 'approved');

drop policy if exists "Users can insert own tester profile" on public.tester_profiles;
create policy "Users can insert own tester profile" on public.tester_profiles
  for insert with check (auth.uid() = user_id and status = 'pending');

drop policy if exists "Users can update own tester profile" on public.tester_profiles;
create policy "Users can update own tester profile" on public.tester_profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- TEST_REQUESTS (Owner-only, plus invited testers can read)
drop policy if exists "Owners and invited testers can view test requests" on public.test_requests;
create policy "Owners and invited testers can view test requests" on public.test_requests
  for select using (
    auth.uid() = owner_id or
    exists (
      select 1 from public.test_invites i
      where i.request_id = test_requests.id and i.tester_id = auth.uid()
    )
  );

drop policy if exists "Owners can manage own test requests" on public.test_requests;
create policy "Owners can manage own test requests" on public.test_requests
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- TEST_INVITES
drop policy if exists "Testers and request owners can view invites" on public.test_invites;
create policy "Testers and request owners can view invites" on public.test_invites
  for select using (
    auth.uid() = tester_id or
    exists (select 1 from public.test_requests r where r.id = test_invites.request_id and r.owner_id = auth.uid())
  );

drop policy if exists "Owners can create invites" on public.test_invites;
create policy "Owners can create invites" on public.test_invites
  for insert with check (
    exists (select 1 from public.test_requests r where r.id = test_invites.request_id and r.owner_id = auth.uid())
  );

drop policy if exists "Testers can update own invite status" on public.test_invites;
create policy "Testers can update own invite status" on public.test_invites
  for update using (auth.uid() = tester_id) with check (auth.uid() = tester_id);

-- TEST_REPORTS
drop policy if exists "Reporter and request owner can view reports" on public.test_reports;
create policy "Reporter and request owner can view reports" on public.test_reports
  for select using (
    auth.uid() = reporter_id or
    exists (select 1 from public.test_requests r where r.id = test_reports.request_id and r.owner_id = auth.uid())
  );

drop policy if exists "Accepted testers can insert reports" on public.test_reports;
create policy "Accepted testers can insert reports" on public.test_reports
  for insert with check (auth.uid() = reporter_id);

drop policy if exists "Owner or reporter can update reports" on public.test_reports;
create policy "Owner or reporter can update reports" on public.test_reports
  for update using (
    auth.uid() = reporter_id or
    exists (select 1 from public.test_requests r where r.id = test_reports.request_id and r.owner_id = auth.uid())
  );

-- REPORT_MESSAGES
drop policy if exists "Reporter and owner can view messages" on public.report_messages;
create policy "Reporter and owner can view messages" on public.report_messages
  for select using (
    exists (
      select 1 from public.test_reports rep
      join public.test_requests req on req.id = rep.request_id
      where rep.id = report_messages.report_id
      and (rep.reporter_id = auth.uid() or req.owner_id = auth.uid())
    )
  );

drop policy if exists "Reporter and owner can insert messages" on public.report_messages;
create policy "Reporter and owner can insert messages" on public.report_messages
  for insert with check (
    auth.uid() = sender_id and
    exists (
      select 1 from public.test_reports rep
      join public.test_requests req on req.id = rep.request_id
      where rep.id = report_messages.report_id
      and (rep.reporter_id = auth.uid() or req.owner_id = auth.uid())
    )
  );
