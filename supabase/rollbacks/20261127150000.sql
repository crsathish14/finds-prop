-- Rollback for 20261127150000_ai_web_search.sql (ADR-218). Reviewed, never run automatically: a person runs it by hand,
-- after the app no longer reads or writes these objects. It drops the web search memory and the admin's switch and
-- credit; the usage rows lose their web search count.

drop function if exists public.admin_ai_assistant_overview();
drop function if exists public.ai_web_search_on();
drop table if exists public.ai_assistant_settings;
drop table if exists public.ai_web_answers;
alter table public.ai_usage_events drop column if exists web_searches;
