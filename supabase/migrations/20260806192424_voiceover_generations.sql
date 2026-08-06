-- Voiceover Generator job table. TTS via Replicate resolves in seconds (not
-- minutes like video), so unlike video_generations this never needs a
-- webhook/cron completion path -- the POST route's after() background job
-- (see /api/generate-voiceover/route.ts) is the only writer. Still async
-- from the client's perspective (insert 'generating', respond immediately,
-- client polls GET) for the same reason generate-image/route.ts is: a
-- multi-segment script calling Replicate several times can take longer than
-- is safe to hold one HTTP response open for.
create table public.voiceover_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  title text not null default 'Untitled Script',
  script text not null,

  -- Replicate google/gemini-3.1-flash-tts `voice` enum value, e.g. "Kore"
  -- (see src/lib/config/voices.ts) -- doubles as the display name, unlike
  -- MiniMax's slug-style ids, so there's no separate display-name column.
  voice_id text not null,

  generation_mode text not null check (generation_mode in ('line_by_line', 'all_at_once')),
  speed numeric not null default 1.08,
  -- 0-100 UI slider -- see src/lib/server/replicate-tts.ts for how this
  -- maps onto the underlying model's actual (non-numeric, prompt-based)
  -- style control. No `similarity` column -- Gemini's preset voices have no
  -- voice-cloning-fidelity concept for that ElevenLabs-specific slider to
  -- map onto, so it was dropped from the UI entirely rather than kept inert.
  stability integer not null default 80,

  -- Array of { index, text, audioPath, durationSeconds }. audioPath is a
  -- Storage object path (voiceovers bucket, see the bucket migration next to
  -- this one), not a public URL -- playback is brokered through
  -- /api/generate-voiceover/[id]/segments/[index] so a signed URL can be
  -- minted per request, same private-bucket pattern video_generations uses.
  segments jsonb not null default '[]'::jsonb,

  status text not null default 'generating' check (status in ('generating', 'completed', 'failed')),
  error_message text,

  -- Same "quote at submit time, charge verbatim on completion" discipline as
  -- video_generations.credits_quoted -- see that table's own comment.
  credits_quoted integer not null,
  credits_charged integer,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.voiceover_generations enable row level security;

create policy "Users can view own voiceover generations"
  on public.voiceover_generations for select
  using (auth.uid() = user_id);

create policy "Users can create own voiceover generations"
  on public.voiceover_generations for insert
  with check (auth.uid() = user_id);

create policy "Users can update own voiceover generations"
  on public.voiceover_generations for update
  using (auth.uid() = user_id);

create policy "Users can delete own voiceover generations"
  on public.voiceover_generations for delete
  using (auth.uid() = user_id);

create trigger voiceover_generations_set_updated_at
  before update on public.voiceover_generations
  for each row
  execute function public.set_updated_at();

create index voiceover_generations_user_id_idx on public.voiceover_generations (user_id, created_at desc);
create index voiceover_generations_status_idx on public.voiceover_generations (status) where status = 'generating';
