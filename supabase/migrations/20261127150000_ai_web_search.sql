-- AI chat web search (ADR-218, owner decisions of 27 Nov 2026, `ai-chat-next-plan.md` pieces 5 and 7).
--   1. `ai_usage_events.web_searches`: how many paid web searches a message made (0 or 1, the provider may report more),
--      for the estimated spend. A number only.
--   2. `ai_web_answers`: the 7-day web search memory. It keeps the search words the assistant wrote, the short answer the
--      search gave and its sources (title and address), never the visitor's own message or details. One row per search
--      words; a fresh search of the same words replaces the answer and keeps counting how often it was used. Only the
--      server writes and reads it (service role); RLS is on and no client role holds any privilege, like
--      `ai_usage_events`. The super admin reads the most used rows through `admin_ai_assistant_overview`.
--   3. `ai_assistant_settings`: the admin's Web search switch and the credit bought (US dollars), one row. Only the super
--      admin reads and writes it; the chat asks `ai_web_search_on()` on every message.
--   4. `admin_ai_assistant_overview()`: the numbers of the admin AI assistant page, from our own records.
-- Rollback note: nothing else depends on the new objects, and the app treats a failed read as "web search off" and a
-- failed write as no memory. To undo: drop the three functions and the two tables and the column, after taking the
-- readers and writers out of the app (supabase/rollbacks/20261127150000.sql), or fix forward.

-- 1. The count of paid web searches on the usage row.
alter table public.ai_usage_events
  add column web_searches integer not null default 0 check (web_searches between 0 and 20);

-- 2. The web search memory.
create table public.ai_web_answers (
  id uuid primary key default gen_random_uuid(),
  -- The search words, lower case with single spaces: what "the same thing asked again" is matched by.
  query_key text not null unique check (
    char_length(query_key) between 2 and 200 and query_key = lower(query_key) and query_key !~ '\s{2,}'
  ),
  -- The search words as the assistant wrote them: one line, no control characters.
  query text not null check (char_length(query) between 2 and 200 and query !~ '[[:cntrl:]]'),
  answer text not null check (char_length(answer) between 1 and 4000),
  -- [{ "title": text, "url": "https://…" }], at most 5.
  sources jsonb not null default '[]' check (jsonb_typeof(sources) = 'array' and jsonb_array_length(sources) <= 5),
  searched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  times_used integer not null default 1 check (times_used >= 1),
  last_used_at timestamptz not null default now(),
  check (expires_at > searched_at)
);

alter table public.ai_web_answers enable row level security;
revoke all on table public.ai_web_answers from anon, authenticated;

create index ai_web_answers_most_used on public.ai_web_answers (times_used desc, last_used_at desc);

-- 3. The admin's switch and the credit bought.
create table public.ai_assistant_settings (
  id smallint primary key default 1 check (id = 1),
  web_search boolean not null default false,
  credit_bought_usd numeric(10, 2) check (credit_bought_usd is null or credit_bought_usd >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

insert into public.ai_assistant_settings (id) values (1);

alter table public.ai_assistant_settings enable row level security;
revoke all on table public.ai_assistant_settings from anon, authenticated;
grant select, update (web_search, credit_bought_usd, updated_at, updated_by)
  on table public.ai_assistant_settings to authenticated;

create policy ai_assistant_settings_admin_select on public.ai_assistant_settings
  for select to authenticated using ((select public.is_super_admin()));
create policy ai_assistant_settings_admin_update on public.ai_assistant_settings
  for update to authenticated
  using ((select public.is_super_admin()))
  with check ((select public.is_super_admin()));

-- Whether the assistant may search the web now. Any caller may ask (it says nothing but yes or no); off when unsure.
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

-- 4. The admin AI assistant page: this month's use in India time (messages, tokens, paid web searches), the switch and
-- the credit bought, and the 50 web answers used most. Money is not worked out here: the app prices the counts with
-- the model's price from its configuration. Only the super admin; anyone else is refused.
create function public.admin_ai_assistant_overview()
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
