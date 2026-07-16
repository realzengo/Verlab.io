-- No RLS policies granted to anon/authenticated: the waitlist is written and
-- read exclusively through /api/affiliates/waitlist using the service-role
-- client, so the signup list can never be enumerated by a client query.
create table public.affiliate_waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.affiliate_waitlist enable row level security;
