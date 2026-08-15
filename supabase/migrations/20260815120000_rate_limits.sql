-- Backs per-user rate limiting on the AI-generation routes (see
-- src/lib/server/rate-limit.ts) with a fixed-window counter. No Redis/
-- Upstash in this stack -- everything else here already goes through
-- Postgres via .rpc() (see deduct_credits, redeem_promo_code), so this
-- follows the same pattern instead of introducing new infra.
create table public.rate_limit_hits (
  id bigint generated always as identity primary key,
  bucket_key text not null,
  created_at timestamptz not null default now()
);

create index rate_limit_hits_bucket_created_idx on public.rate_limit_hits (bucket_key, created_at desc);

-- Only ever touched by the service-role client (via check_rate_limit
-- below), never by a user session -- RLS on with no policies blocks
-- anon/authenticated access outright.
alter table public.rate_limit_hits enable row level security;

-- Records one hit for p_bucket_key, prunes that bucket's hits older than
-- the window (keeps the table from growing unbounded without a separate
-- cron job), and returns the resulting count within the window. Caller
-- compares the count against its own limit.
create or replace function public.check_rate_limit(p_bucket_key text, p_window_seconds int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  insert into public.rate_limit_hits (bucket_key) values (p_bucket_key);

  delete from public.rate_limit_hits
  where bucket_key = p_bucket_key
    and created_at < now() - (p_window_seconds || ' seconds')::interval;

  select count(*) into v_count
  from public.rate_limit_hits
  where bucket_key = p_bucket_key
    and created_at >= now() - (p_window_seconds || ' seconds')::interval;

  return v_count;
end;
$$;
