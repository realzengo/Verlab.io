-- Instagram stays allowed here for the sake of pre-existing historical rows
-- (created back when downloads went through a different provider) even
-- though the app no longer lets users start new Instagram downloads.
alter table public.downloads
  drop constraint downloads_platform_check;

alter table public.downloads
  add constraint downloads_platform_check check (platform in ('tiktok','youtube','facebook','instagram'));
