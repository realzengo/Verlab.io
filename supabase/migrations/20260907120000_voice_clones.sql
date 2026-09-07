-- User-cloned voices for the Voiceover Generator's "Add Your Voice" flow.
-- Audio is never stored by us -- Replicate/MiniMax hold the cloned voice
-- behind `voice_id` (see src/lib/server/replicate-voice-clone.ts), so this
-- table is metadata only. voiceover_generations.voice_id is free text with
-- no FK (see 20260806192424_voiceover_generations.sql), so a cloned voice is
-- addressed there as `clone:<this table's id>` -- no schema change needed on
-- that table for TTS to dispatch to a cloned voice instead of the fixed
-- catalog (see src/lib/server/voice-resolution.ts).
create table public.voice_clones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  name text not null,

  -- Replicate's minimax/voice-cloning voice_id (e.g. "R8_FDU1SV5S"), usable
  -- directly as minimax/speech-02-turbo's own `voice_id` input.
  voice_id text not null unique,

  -- Credits charged at creation time (see getVoiceCloneCost() in
  -- src/lib/config/pricing.ts) -- kept on the row for admin auditing, same
  -- rationale as voiceover_generations.credits_quoted.
  credits_charged integer not null default 0,

  created_at timestamptz not null default now()
);

alter table public.voice_clones enable row level security;

create policy "Users can view own voice clones"
  on public.voice_clones for select
  using (auth.uid() = user_id);

create policy "Users can create own voice clones"
  on public.voice_clones for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own voice clones"
  on public.voice_clones for delete
  using (auth.uid() = user_id);

create index voice_clones_user_id_idx on public.voice_clones (user_id, created_at desc);
