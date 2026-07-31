-- Generated/edited videos + their thumbnails. Unlike avatars_bucket.sql
-- (public: true -- profile pictures are meant to be publicly linkable),
-- this bucket is private: it's paid, per-user AI output, not public
-- profile media. Playback always goes through /api/library/video/[id],
-- which checks row ownership against video_generations before minting a
-- short-lived signed URL -- nothing here is ever served from a bare public
-- URL.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'videos',
  'videos',
  false,
  524288000, -- 500MB ceiling per object -- generous for a 4K/60s clip, well above anything the current model catalog can produce
  array['video/mp4', 'video/webm', 'video/quicktime', 'image/jpeg', 'image/png']
)
on conflict (id) do nothing;

-- Objects live at <user_id>/<generation_id>/output.mp4 (or thumb.jpg), so
-- ownership is checked the same way avatars_bucket.sql does it -- from the
-- first path segment, not a DB lookup.
create policy "Users can view their own videos"
  on storage.objects for select
  using (
    bucket_id = 'videos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Application code writes with the service-role client (the webhook/cron
-- handlers that produce these files run with no user session), so this
-- policy exists for parity/defense-in-depth rather than being load-bearing
-- for the normal write path -- service role bypasses RLS entirely.
create policy "Users can upload their own videos"
  on storage.objects for insert
  with check (
    bucket_id = 'videos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete their own videos"
  on storage.objects for delete
  using (
    bucket_id = 'videos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
