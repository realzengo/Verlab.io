-- Display/role layer on top of the ADMIN_EMAILS env-var allowlist, which
-- remains the actual access control in src/proxy.ts — this table only gives
-- the admin settings page real names/roles/last-login instead of hardcoded
-- data. Left unseeded on purpose (no fake team members); populate rows for
-- each address already listed in ADMIN_EMAILS via the Supabase dashboard or
-- a follow-up admin "invite" flow.
create table public.admin_team (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text not null unique,
  role text not null check (role in ('owner','admin','support')),
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

alter table public.admin_team enable row level security;
-- Service-role only (no RLS grants).
