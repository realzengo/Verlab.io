-- Admin-editable pricing copy, replacing mock/pricing.ts's PRICING_PLANS.
-- price_monthly/price_yearly are plain dollar amounts for now; when billing
-- lands they become the source-of-truth mapping to Stripe Price IDs instead.
create table public.plan_definitions (
  id text primary key check (id in ('core','pro','scale')),
  name text not null,
  info text not null,
  price_monthly numeric not null,
  price_yearly numeric not null,
  recommended boolean not null default false,
  monthly_only boolean not null default false,
  cta text not null,
  features jsonb not null default '[]',
  limits text,
  sort_order int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.plan_definitions enable row level security;

create policy "Anyone can read plan definitions"
  on public.plan_definitions for select
  using (true);
-- Writes: service-role only, via /api/admin/plan-definitions.

create trigger plan_definitions_set_updated_at
  before update on public.plan_definitions
  for each row
  execute function public.set_updated_at();

insert into public.plan_definitions (id, name, info, price_monthly, price_yearly, recommended, monthly_only, cta, features, sort_order) values
  ('core', 'Core', 'Transcripts and niche bending to get started', 19, 19 * 12, false, true, 'Start Core',
   '[{"text":"Unlimited transcripts"},{"text":"TikTok, Reels & Shorts"},{"text":"20 niche bends per month"},{"text":"Script Maker"},{"text":"TXT export"}]'::jsonb, 1),
  ('pro', 'Pro', 'Everything you need to bend and scale', 39, 30 * 12, true, false, 'Start Pro',
   '[{"text":"Everything in Core"},{"text":"Unlimited niche bending"},{"text":"Viral AI agents"},{"text":"Cloud library"},{"text":"AI exports (TXT/PDF/XML)"}]'::jsonb, 2),
  ('scale', 'Scale', 'For teams and power users who need API access', 89, 66 * 12, false, false, 'Start Scale',
   '[{"text":"Everything in Pro"},{"text":"Priority support"},{"text":"API access","tooltip":"Programmatic access to your transcripts, SOPs and scripts"},{"text":"MCP for Claude & ChatGPT","tooltip":"Connect your library directly to Claude or ChatGPT via MCP"}]'::jsonb, 3)
on conflict (id) do nothing;
