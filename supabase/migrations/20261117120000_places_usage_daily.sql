-- Place search PR 3a (ADR-134, OLA_MAPS_PLAN.md section 4.6): how often the site called Ola Maps, counted per day.
-- One row for each day, API, caller and outcome, holding only a number: no typed text, no place name, no visitor
-- hash, no user id and nothing personal. Only the server writes it (through `record_places_call`, service role only)
-- and only the super admin reads it (through `admin_places_usage`). RLS is on and no client role holds any privilege,
-- the same as `ai_usage_events`. The count is the owner's guide to the free allowance, not Ola's invoice; there is no
-- cost, no allowance and no balance anywhere in it (owner, 17 Nov 2026).
-- `api` is text, with a check on its shape, so a later Ola API needs no migration; `caller` and `outcome` are closed
-- lists (a new one is a one-line migration). `day` is the calendar day in India time.
-- Old rows are swept by the retention job (next migration, 24 months, provisional).
-- Rollback note: nothing else depends on the table or the two functions, and the app tolerates a failed write (PR 3b
-- logs it and carries on). To undo: drop both functions and the table after taking the writer out of the app, or fix forward.

create table public.places_usage_daily (
  day date not null,
  api text not null check (api ~ '^[a-z][a-z0-9_]*$' and char_length(api) <= 40),
  caller text not null check (caller in ('search_box', 'listing_form', 'admin_picker', 'ai_chat')),
  outcome text not null check (outcome in ('ok', 'empty', 'timeout', 'quota', 'error')),
  calls integer not null default 0 check (calls >= 0),
  -- The key also serves the month and range reads (they filter by day) and the retention sweep.
  primary key (day, api, caller, outcome)
);

alter table public.places_usage_daily enable row level security;

-- No policy and no grant: not even the admin reads the table through the API; the admin reads the function below.
revoke all on table public.places_usage_daily from anon, authenticated;

-- Counts one call that reached Ola. The server calls it with the service role, after the answer has gone out.
-- The insert and the increment are one statement, so two calls at the same moment are both counted.
create function public.record_places_call(p_api text, p_caller text, p_outcome text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_api is null or p_api !~ '^[a-z][a-z0-9_]*$' or char_length(p_api) > 40 then
    raise exception 'places_usage.bad_api' using errcode = '22023';
  end if;
  if p_caller is null or p_caller not in ('search_box', 'listing_form', 'admin_picker', 'ai_chat') then
    raise exception 'places_usage.bad_caller' using errcode = '22023';
  end if;
  if p_outcome is null or p_outcome not in ('ok', 'empty', 'timeout', 'quota', 'error') then
    raise exception 'places_usage.bad_outcome' using errcode = '22023';
  end if;

  insert into public.places_usage_daily as counted (day, api, caller, outcome, calls)
  values ((now() at time zone 'Asia/Kolkata')::date, p_api, p_caller, p_outcome, 1)
  on conflict (day, api, caller, outcome) do update set calls = counted.calls + 1;
end;
$$;

revoke execute on function public.record_places_call(text, text, text) from public, anon, authenticated;
grant execute on function public.record_places_call(text, text, text) to service_role;

-- The numbers of the admin dashboard's place search card, as one JSON object (the same style as `admin_overview`,
-- ADR-121): the calls of each day of the range (a zero for a quiet day), the total, how they split by API, by caller
-- and by outcome, and how many ended badly (timeout, quota or error). `today` and `month` are the current day and the
-- current month so far in India time, whatever the range. The table has no policy, so this runs as its owner and
-- checks the role itself, exactly as `admin_overview` does (only the super admin); anyone else is refused.
-- A range is at most 92 days, counting both ends.
create function public.admin_places_usage(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Asia/Kolkata')::date;
  month_start date := date_trunc('month', (now() at time zone 'Asia/Kolkata'))::date;
  daily jsonb;
  by_api jsonb;
  by_caller jsonb;
  by_outcome jsonb;
  range_total bigint;
begin
  if not (select public.is_super_admin()) then
    raise exception 'places_usage.not_allowed' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 91 then
    raise exception 'places_usage.bad_range' using errcode = '22023';
  end if;

  -- One entry for each day of the range, in order, with a zero where nothing was called.
  select coalesce(jsonb_agg(jsonb_build_object(
    'day', to_char(series.day, 'YYYY-MM-DD'),
    'calls', coalesce(per_day.calls, 0)
  ) order by series.day), '[]'::jsonb) into daily
  from (select generate_series(p_from::timestamp, p_to::timestamp, interval '1 day')::date as day) as series
  left join (
    select counted.day, sum(counted.calls) as calls
    from public.places_usage_daily as counted
    where counted.day between p_from and p_to
    group by counted.day
  ) as per_day on per_day.day = series.day;

  select coalesce(sum(counted.calls), 0) into range_total
  from public.places_usage_daily as counted
  where counted.day between p_from and p_to;

  -- The APIs that were called in the range, the busiest first.
  select coalesce(jsonb_agg(jsonb_build_object('api', found.api, 'calls', found.calls)
    order by found.calls desc, found.api), '[]'::jsonb) into by_api
  from (
    select counted.api, sum(counted.calls) as calls
    from public.places_usage_daily as counted
    where counted.day between p_from and p_to
    group by counted.api
  ) as found;

  -- Every caller and every outcome is always present, with a zero, so the card has nothing to guess.
  select jsonb_object_agg(listed.caller, coalesce(found.calls, 0)) into by_caller
  from unnest(array['search_box', 'listing_form', 'admin_picker', 'ai_chat']) as listed(caller)
  left join (
    select counted.caller, sum(counted.calls) as calls
    from public.places_usage_daily as counted
    where counted.day between p_from and p_to
    group by counted.caller
  ) as found on found.caller = listed.caller;

  select jsonb_object_agg(listed.outcome, coalesce(found.calls, 0)) into by_outcome
  from unnest(array['ok', 'empty', 'timeout', 'quota', 'error']) as listed(outcome)
  left join (
    select counted.outcome, sum(counted.calls) as calls
    from public.places_usage_daily as counted
    where counted.day between p_from and p_to
    group by counted.outcome
  ) as found on found.outcome = listed.outcome;

  return jsonb_build_object(
    'total', range_total,
    'today', (select coalesce(sum(counted.calls), 0) from public.places_usage_daily as counted where counted.day = today),
    'month', (
      select coalesce(sum(counted.calls), 0) from public.places_usage_daily as counted
      where counted.day >= month_start and counted.day <= today
    ),
    'days', daily,
    'apis', by_api,
    'callers', by_caller,
    'outcomes', by_outcome,
    'problems', (by_outcome ->> 'timeout')::bigint + (by_outcome ->> 'quota')::bigint + (by_outcome ->> 'error')::bigint
  );
end;
$$;

revoke execute on function public.admin_places_usage(date, date) from public, anon, authenticated;
grant execute on function public.admin_places_usage(date, date) to authenticated, service_role;
