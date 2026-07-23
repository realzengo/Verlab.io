-- The generate-image route used to await the full generation (which can take
-- minutes, especially for Nano Banana Pro / flux-2-dev -- see cloudflare-image.ts)
-- before sending any HTTP response. Holding one long-lived connection open that
-- long is unreliable: proxies/gateways/browsers can kill it mid-flight, which
-- made the UI's pending tile disappear even though the server kept generating
-- and wrote the result to this table minutes later via `after()`. Reworking the
-- route to return immediately and generate in the background (mirroring
-- niche_bend_jobs) needs a status to poll instead of relying on one response.
alter table public.image_generations
  add column status text not null default 'completed' check (status in ('generating', 'completed', 'failed')),
  add column error_message text;

alter table public.image_generations alter column images set default '[]'::jsonb;
