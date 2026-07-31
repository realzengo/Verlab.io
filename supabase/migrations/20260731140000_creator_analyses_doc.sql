-- Adds storage for the branded .docx report generated alongside each
-- creator analysis, so check_creator_analysis_status can hand it back on a
-- second poll without re-running the LLM pass.
alter table public.creator_analyses
  add column doc_base64 text,
  add column doc_filename text,
  add column analysis jsonb;
