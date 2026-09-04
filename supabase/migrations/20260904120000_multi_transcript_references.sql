-- Allow multiple transcript reference files per user (SOP stays singular).
-- The old unique(user_id, kind) constraint capped every kind -- including
-- "transcript" -- at one row per user; script-references route now appends
-- transcript uploads instead of replacing the single row, so that broad
-- constraint has to go. A partial unique index re-adds the same "one row"
-- guarantee for kind = 'sop' only.

alter table public.script_reference_files
  drop constraint if exists script_reference_files_user_id_kind_key;

create unique index script_reference_files_one_sop_per_user
  on public.script_reference_files (user_id)
  where kind = 'sop';
