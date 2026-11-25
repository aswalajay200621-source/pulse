-- ==============================================================================
-- PULSE – ROLE-BASED REGISTRATION & PROFILES MIGRATION
-- Run this script in the Supabase Dashboard SQL Editor
-- ==============================================================================

-- 1. Extend public.profiles
alter table public.profiles
  add column if not exists display_name text,
  add column if not exists roles text[] not null default array['developer']::text[],
  add column if not exists onboarding_completed boolean not null default false;

-- Add CHECK constraint on roles: non-empty and only 'developer' / 'tester'
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chk_profiles_roles_valid'
  ) then
    alter table public.profiles
      add constraint chk_profiles_roles_valid
      check (
        array_length(roles, 1) >= 1
        and roles <@ array['developer', 'tester']::text[]
      );
  end if;
end $$;

-- Migrate existing users to developer role with onboarding completed
update public.profiles
set
  roles = array['developer']::text[],
  onboarding_completed = true,
  display_name = coalesce(nullif(display_name, ''), nullif(full_name, ''), split_part(email, '@', 1))
where onboarding_completed = false;

-- Update handle_new_user trigger so new signups start with onboarding_completed = false
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, display_name, email, roles, onboarding_completed, created_at, updated_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    left(coalesce(new.raw_user_meta_data->>'full_name', ''), 60),
    new.email,
    array['developer']::text[],
    false,
    now(),
    now()
  )
  on conflict (id) do update set
    email = excluded.email,
    updated_at = now();
  return new;
end;
$$;

-- 2. Extend public.tester_profiles
alter table public.tester_profiles
  add column if not exists contact text,
  add column if not exists needs_review boolean not null default false,
  add column if not exists updated_at timestamptz default now() not null;

-- Ensure RLS on tester_profiles prevents users from changing their own status
drop policy if exists "Users can update own tester profile" on public.tester_profiles;
create policy "Users can update own tester profile" on public.tester_profiles
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and status = (select tp.status from public.tester_profiles tp where tp.user_id = auth.uid())
  );
