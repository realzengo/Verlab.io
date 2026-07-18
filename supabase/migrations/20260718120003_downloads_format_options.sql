-- 'mp4' stays allowed here for pre-existing historical rows (created back
-- when the app only offered a generic mp4/mp3 choice) even though new
-- downloads now pick a specific format code from DOWNLOAD_FORMAT_OPTIONS.
alter table public.downloads
  drop constraint downloads_format_check;

alter table public.downloads
  add constraint downloads_format_check
  check (format in ('mp3','m4a','aac','flac','wav','360','720','1080','1440','mp44k','mp48k','mp4'));
