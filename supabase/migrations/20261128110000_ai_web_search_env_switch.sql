-- destructive: drops ai_web_search_on() and ai_assistant_settings.web_search, an off-by-default switch nothing reads any more (owner decision 28 Nov 2026, ADR-218); no stored data of value is lost.
-- ADR-218 amended (owner decision, 28 Nov 2026): the web search is switched on and off by the server setting
-- FLAG_AI_WEB_SEARCH, not by an admin switch in the database, so the chat no longer reads the database on every
-- message to know.
--   1. `ai_web_search_on()` is dropped: nothing calls it any more.
--   2. `admin_ai_assistant_overview()` is made again without `webSearch` in its settings (same arguments, grants
--      and checks).
--   3. `ai_assistant_settings.web_search` is dropped; the row keeps the credit bought and who changed it last.
-- Rollback: supabase/rollbacks/20261128110000.sql (adds the column back, switched off, and both functions as they were).

drop function public.ai_web_search_on();

create or replace function public.admin_ai_assistant_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  month_start constant timestamptz :=
    (date_trunc('month', now() at time zone 'Asia/Kolkata')) at time zone 'Asia/Kolkata';
begin
  if not (select public.is_super_admin()) then
    raise exception 'ai_assistant.not_allowed' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'settings', (
      select jsonb_build_object('creditBoughtUsd', settings.credit_bought_usd)
      from public.ai_assistant_settings as settings where settings.id = 1
    ),
    'month', (
      select jsonb_build_object(
        'messages', count(*),
        'inputTokens', coalesce(sum(usage.input_tokens), 0),
        'cachedInputTokens', coalesce(sum(usage.cached_input_tokens), 0),
        'outputTokens', coalesce(sum(usage.output_tokens), 0),
        'webSearches', coalesce(sum(usage.web_searches), 0)
      )
      from public.ai_usage_events as usage
      where usage.occurred_at >= month_start
    ),
    'answers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'query', used.query, 'timesUsed', used.times_used, 'lastUsedAt', used.last_used_at
      ) order by used.times_used desc, used.last_used_at desc)
      from (
        select answer.query, answer.times_used, answer.last_used_at
        from public.ai_web_answers as answer
        order by answer.times_used desc, answer.last_used_at desc
        limit 50
      ) as used
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.admin_ai_assistant_overview() from public, anon;
grant execute on function public.admin_ai_assistant_overview() to authenticated, service_role;

alter table public.ai_assistant_settings drop column web_search;
