alter table public.transcripts
  add column video_url text,
  add column embed_url text;

alter table public.transcripts
  alter column provider set default 'scrapecreators';
