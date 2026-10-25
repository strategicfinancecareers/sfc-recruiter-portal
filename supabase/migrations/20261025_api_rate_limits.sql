-- Fixed-window rate limiting for the public / AI-backed API endpoints.
-- One row per bucket (e.g. 'parse:203.0.113.7' or 'fetchjob:<userId>').
-- bump_rate_limit() is atomic (single upsert), so concurrent lambdas
-- cannot double-count or race the window reset.

create table public.api_rate_limits (
  bucket text primary key,
  window_start timestamptz not null,
  hits integer not null default 0
);

-- Service-role only: RLS on with no policies blocks anon/authenticated
-- PostgREST access entirely.
alter table public.api_rate_limits enable row level security;

create or replace function public.bump_rate_limit(
  p_bucket text,
  p_window_seconds integer,
  p_max integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed boolean;
begin
  insert into public.api_rate_limits as r (bucket, window_start, hits)
  values (p_bucket, now(), 1)
  on conflict (bucket) do update set
    hits = case
      when r.window_start < now() - make_interval(secs => p_window_seconds) then 1
      else r.hits + 1
    end,
    window_start = case
      when r.window_start < now() - make_interval(secs => p_window_seconds) then now()
      else r.window_start
    end
  returning r.hits <= p_max into allowed;
  return allowed;
end;
$$;

-- Only the service role may call it (the API Gateway advisor flagged the
-- project's older SECURITY DEFINER functions as anon-executable; don't
-- repeat that here).
revoke execute on function public.bump_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.bump_rate_limit(text, integer, integer) to service_role;
