-- Log of sign-ups and checkouts that the fraud guards blocked (see
-- src/lib/server/abuse-guards.ts and src/app/api/auth/before-user-created).
-- Written only by server code with the service role; no client access.
-- Apply in the Supabase SQL editor -- do not run `supabase db push`.

create table if not exists public.blocked_attempts (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('signup', 'checkout')),
  reason text not null,
  ip text,
  email text,
  user_id uuid
);

create index if not exists blocked_attempts_created_at_idx on public.blocked_attempts (created_at desc);

alter table public.blocked_attempts enable row level security;
-- No policies on purpose: anon and authenticated users can't read or write.
revoke all on table public.blocked_attempts from anon, authenticated;

comment on table public.blocked_attempts is
  'Blocked sign-ups (disposable email, too many per IP) and checkouts (unconfirmed email, rate limit, failed Turnstile). Server-only.';
