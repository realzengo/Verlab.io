-- Transient staging bucket used only inside POST /api/voice-clones: a
-- user's uploaded/recorded sample is written here just long enough to hand
-- Replicate's minimax/voice-cloning a signed URL with a real audio
-- extension in its path (a bare data URI is rejected -- see
-- replicate-voice-clone.ts's module comment for the live-confirmed
-- "invalid file ext" failure), then the route deletes the object itself in
-- a `finally` block once the clone call resolves either way. Unlike
-- `voiceovers`, nothing here is meant to persist -- the cloned voice lives
-- on MiniMax's side afterward, addressed by voice_id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'voice-clone-uploads',
  'voice-clone-uploads',
  false,
  20971520, -- 20MB, matching minimax/voice-cloning's own ceiling
  array['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/x-wav', 'audio/wave']
)
on conflict (id) do nothing;

-- Objects live at <user_id>/<timestamp>.<ext>, same per-user-prefix
-- convention as every other bucket's policies in this codebase. Application
-- code only ever touches this bucket via the service-role client (which
-- bypasses RLS), so these exist for defense-in-depth parity with every
-- other bucket's policies, not because anything load-bearing reads them.
create policy "Users can view their own voice clone samples"
  on storage.objects for select
  using (
    bucket_id = 'voice-clone-uploads'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can upload their own voice clone samples"
  on storage.objects for insert
  with check (
    bucket_id = 'voice-clone-uploads'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete their own voice clone samples"
  on storage.objects for delete
  using (
    bucket_id = 'voice-clone-uploads'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
