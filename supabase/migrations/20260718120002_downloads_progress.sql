alter table public.downloads
  add column progress smallint not null default 0 check (progress between 0 and 100);
