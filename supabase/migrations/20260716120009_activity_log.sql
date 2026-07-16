-- Admin-visible feed. Service-role only (no RLS grants), written by server
-- routes at key moments (job failed, SOP generated, waitlist signup, etc).
-- 'billing'-typed entries stay empty until Stripe is wired up.
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('billing','user','system','content')),
  message text not null,
  actor text not null,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.activity_log enable row level security;

create index activity_log_created_at_idx on public.activity_log (created_at desc);
