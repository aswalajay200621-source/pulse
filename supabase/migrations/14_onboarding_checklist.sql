-- ==============================================================================
-- PULSE – FIRST-RUN CHECKLIST MIGRATION
-- Run this script in the Supabase Dashboard SQL Editor
-- ==============================================================================

alter table public.profiles
  add column if not exists checklist_dismissed boolean not null default false,
  add column if not exists checklist_skipped_steps text[] not null default '{}'::text[];
