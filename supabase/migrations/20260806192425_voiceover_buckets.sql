-- Generated voiceover segments -- private, paid per-user AI output, same
-- rationale as videos_bucket.sql. Playback always goes through
-- /api/generate-voiceover/[id]/segments/[index], which checks row ownership
-- against voiceover_generations before minting a short-lived signed URL.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'voiceovers',
  'voiceovers',
  false,
  26214400, -- 25MB ceiling per segment -- generous for a single script chunk of speech audio
  array['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav']
)
on conflict (id) do nothing;

-- Objects live at <user_id>/<generation_id>/<segment_index>.mp3, so
-- ownership is checked from the first path segment, same as
-- videos_bucket.sql / avatars_bucket.sql.
create policy "Users can view their own voiceover segments"
  on storage.objects for select
  using (
    bucket_id = 'voiceovers'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can upload their own voiceover segments"
  on storage.objects for insert
  with check (
    bucket_id = 'voiceovers'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete their own voiceover segments"
  on storage.objects for delete
  using (
    bucket_id = 'voiceovers'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Voice preview clips -- a fixed, non-sensitive sample line ("Hi, I'm ...")
-- rendered once per catalog voice and reused for every user forever (see
-- /api/voices/preview/route.ts), so unlike the bucket above this is public:
-- true, same as avatars_bucket.sql, and objects live at a flat
-- <voice_id>.mp3 key with no per-user prefix or RLS ownership check needed.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'voice-previews',
  'voice-previews',
  true,
  5242880, -- 5MB ceiling -- these are a few seconds of speech each
  array['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav']
)
on conflict (id) do nothing;

-- Application code writes with the service-role client (see
-- /api/voices/preview/route.ts), so this policy exists for parity/defense-
-- in-depth rather than being load-bearing, same as videos_bucket.sql's own
-- insert policy comment.
create policy "Anyone can view voice previews"
  on storage.objects for select
  using (bucket_id = 'voice-previews');
