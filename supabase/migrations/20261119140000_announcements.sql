-- Announcement bar at the top of the app: product updates and offers.
--
-- Managed from /admin/announcements, or straight from the Supabase table
-- editor (no deploy either way). The app shows the newest row that is active
-- and not past `expires_at`; closing it shows the next one. Users who close a
-- row never see that id again (kept in their browser's localStorage), so to
-- reach everyone with new news, add a new row rather than editing an old one.
--
-- The app reads through a cache: changes made in /admin show at once, edits
-- made directly in this table show within a minute.
--
--   kind        'update' (product news) | 'promo' (offer or discount)
--   cta_label   button text, optional ("Learn more" if only cta_href is set)
--   cta_href    a path in the app ("/clipping") or a full https:// URL
--   expires_at  hidden from this moment on; null = until turned off
--
-- Every read and write goes through the service role; RLS is on with no
-- policies, so the anon and authenticated roles can't touch it.

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'update' check (kind in ('update', 'promo')),
  message text not null check (char_length(btrim(message)) between 1 and 200),
  cta_label text check (cta_label is null or char_length(cta_label) <= 32),
  -- A same-site path (not protocol-relative "//host") or an http(s) URL.
  cta_href text check (
    cta_href is null
    or (char_length(cta_href) <= 500 and cta_href ~* '^(https?://|/($|[^/\\]))')
  ),
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.announcements enable row level security;

create trigger announcements_set_updated_at
  before update on public.announcements
  for each row
  execute function public.set_updated_at();

create index announcements_active_idx on public.announcements (created_at desc)
  where is_active;
