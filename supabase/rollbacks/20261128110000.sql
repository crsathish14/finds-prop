-- Rollback for 20261128110000_ai_web_search_env_switch.sql (ADR-218). Reviewed, never run automatically: a person runs
-- it by hand, after going back to an app that reads the admin's Web search switch. The switch comes back off.

alter table public.ai_assistant_settings add column if not exists web_search boolean not null default false;
grant update (web_search) on table public.ai_assistant_settings to authenticated;

create function public.ai_web_search_on()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select settings.web_search from public.ai_assistant_settings as settings where settings.id = 1), false)
$$;

revoke execute on function public.ai_web_search_on() from public;
grant execute on function public.ai_web_search_on() to anon, authenticated, service_role;

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
      select jsonb_build_object('webSearch', settings.web_search, 'creditBoughtUsd', settings.credit_bought_usd)
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
