-- ==============================================================================
-- PULSE – OPT-IN PUBLIC STATUS PAGES MIGRATION
-- Run this script in the Supabase Dashboard SQL Editor
-- ==============================================================================

create table if not exists public.status_pages (
  id uuid default gen_random_uuid() primary key,
  application_id uuid references public.applications(id) on delete cascade not null unique,
  user_id uuid references auth.users(id) on delete cascade not null,
  slug text not null unique,
  enabled boolean not null default false,
  display_title text not null,
  allow_indexing boolean not null default false,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists idx_status_pages_slug on public.status_pages(slug);
create index if not exists idx_status_pages_app on public.status_pages(application_id);

alter table public.status_pages enable row level security;

drop policy if exists "Owner can manage own status pages" on public.status_pages;
create policy "Owner can manage own status pages" on public.status_pages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
