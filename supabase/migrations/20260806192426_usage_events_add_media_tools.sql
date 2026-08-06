-- usage_events.tool's check constraint (20260716120008_usage_events.sql)
-- predates the Image/Video/Voiceover generators and only allows
-- ('bend','niches','transcripts','downloader','mcp') -- recordUsageEvent
-- calls for "image"/"video" already exist in the codebase and silently fail
-- this constraint today (usage.ts swallows the error, non-fatal but the
-- event is never recorded). Adding "voiceover" here for the new generator
-- while fixing the same gap for its two existing siblings.
alter table public.usage_events drop constraint usage_events_tool_check;
alter table public.usage_events add constraint usage_events_tool_check
  check (tool in ('bend','niches','transcripts','downloader','mcp','image','video','voiceover'));
