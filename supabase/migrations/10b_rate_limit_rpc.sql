-- Add to migration 10 (or run separately)
-- RPC for atomic rate limit upsert
create or replace function upsert_error_rate_limit(
  p_key_id uuid,
  p_window timestamptz
)
returns table(count integer)
language plpgsql
security definer
as $$
declare
  v_count integer;
begin
  insert into public.error_rate_limits (key_id, window_minute, count)
  values (p_key_id, p_window, 1)
  on conflict (key_id, window_minute)
  do update set count = error_rate_limits.count + 1
  returning error_rate_limits.count into v_count;

  return query select v_count;
end;
$$;
