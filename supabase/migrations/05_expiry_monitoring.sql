-- ==============================================================================
-- PULSE – PHASE 7: SSL, DOMAIN & CREDENTIAL EXPIRY MONITORING MIGRATION
-- Run this script in the Supabase Dashboard SQL Editor
-- ==============================================================================

-- 1. Create EXPIRY_ITEMS table
create table if not exists public.expiry_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  application_id uuid references public.applications(id) on delete cascade,
  category text not null check (category in (
    'ssl_certificate',
    'domain',
    'api_key',
    'oauth_token',
    'service_account',
    'integration',
    'other'
  )),
  name text not null,
  description text,
  target_host text,
  issuer text,
  expiry_date timestamptz,
  status text not null check (status in ('healthy', 'expiring_soon', 'expired', 'unknown', 'error')) default 'unknown',
  days_remaining integer,
  source text not null check (source in ('tls_handshake', 'rdap', 'manual')) default 'manual',
  error_message text,
  last_checked_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists idx_expiry_items_user_id on public.expiry_items(user_id);
create index if not exists idx_expiry_items_app_id on public.expiry_items(application_id);
create index if not exists idx_expiry_items_status on public.expiry_items(status);
create index if not exists idx_expiry_items_category on public.expiry_items(category);

-- 2. Create EXPIRY_REMINDERS table (Duplicate prevention & recalculation on date change)
create table if not exists public.expiry_reminders (
  id uuid default gen_random_uuid() primary key,
  expiry_item_id uuid references public.expiry_items(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  threshold text not null check (threshold in ('30d', '7d', '1d', 'expired')),
  expiry_date_snapshot timestamptz not null,
  sent_at timestamptz default now() not null,
  constraint uq_expiry_reminder_snapshot unique (expiry_item_id, threshold, expiry_date_snapshot)
);

create index if not exists idx_expiry_reminders_item_id on public.expiry_reminders(expiry_item_id);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

alter table public.expiry_items enable row level security;
alter table public.expiry_reminders enable row level security;

drop policy if exists "Users can view own expiry items" on public.expiry_items;
create policy "Users can view own expiry items" on public.expiry_items
  for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own expiry items" on public.expiry_items;
create policy "Users can insert own expiry items" on public.expiry_items
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own expiry items" on public.expiry_items;
create policy "Users can update own expiry items" on public.expiry_items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete own expiry items" on public.expiry_items;
create policy "Users can delete own expiry items" on public.expiry_items
  for delete using (auth.uid() = user_id);

drop policy if exists "Users can view own expiry reminders" on public.expiry_reminders;
create policy "Users can view own expiry reminders" on public.expiry_reminders
  for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own expiry reminders" on public.expiry_reminders;
create policy "Users can insert own expiry reminders" on public.expiry_reminders
  for insert with check (auth.uid() = user_id);
