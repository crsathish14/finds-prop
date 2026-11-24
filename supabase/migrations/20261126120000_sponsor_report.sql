-- Sponsor ads report (ADR-194): how many people saw and clicked each paid placement, by day, for the admin.
-- The three slots: the hero ad under the search (`hero`, keyed by the ad's id in the site content), the Featured
-- project card in the results (`results`, keyed by the builder's id) and the Developer spotlight on the home page
-- (`spotlight`, keyed by the builder's id).
--
-- A view or a click is counted once per visitor, per placement, per day (India time): reloading or coming back the
-- same day adds nothing. Who the visitor is stays the same one-way hash the rate limiter uses (BR-75), and it is kept
-- for the current day only, to tell a repeat: the first count of a new day clears the earlier days. The report keeps
-- only the daily totals, with no visitor in them.
--
-- Nobody reads or writes the tables directly. `record_sponsor_event()` is for the server alone (service role), called
-- by a rate-limited action that first checks the placement is live; `admin_sponsor_report()` is for the super admin.
-- Rollback note: nothing else depends on these. To go back, drop the two functions and the two tables; the counts are
-- lost.

create table public.sponsor_stats (
  day date not null,
  slot text not null check (slot in ('hero', 'results', 'spotlight')),
  sponsor_key text not null check (char_length(sponsor_key) between 1 and 80),
  views integer not null default 0 check (views >= 0),
  clicks integer not null default 0 check (clicks >= 0),
  primary key (day, slot, sponsor_key)
);

create table public.sponsor_seen (
  day date not null,
  slot text not null,
  sponsor_key text not null,
  kind text not null check (kind in ('view', 'click')),
  visitor_hash text not null check (visitor_hash ~ '^[0-9a-f]{40}$'),
  primary key (day, slot, sponsor_key, kind, visitor_hash)
);

alter table public.sponsor_stats enable row level security;
alter table public.sponsor_seen enable row level security;
revoke all on table public.sponsor_stats from public, anon, authenticated;
revoke all on table public.sponsor_seen from public, anon, authenticated;

-- Counts one view or click of a placement for a visitor. True when it was counted, false for a repeat that day.
create function public.record_sponsor_event(
  p_slot text,
  p_key text,
  p_kind text,
  p_visitor_hash text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Asia/Kolkata')::date;
  counted integer;
begin
  if p_slot is null or p_slot not in ('hero', 'results', 'spotlight') then
    raise exception 'sponsor_event.slot' using errcode = '22023';
  end if;
  if p_key is null or char_length(p_key) not between 1 and 80 then
    raise exception 'sponsor_event.key' using errcode = '22023';
  end if;
  if p_kind is null or p_kind not in ('view', 'click') then
    raise exception 'sponsor_event.kind' using errcode = '22023';
  end if;
  if p_visitor_hash is null or p_visitor_hash !~ '^[0-9a-f]{40}$' then
    raise exception 'sponsor_event.visitor' using errcode = '22023';
  end if;

  -- Who saw what is kept for the current day only.
  delete from public.sponsor_seen where day < today;

  insert into public.sponsor_seen (day, slot, sponsor_key, kind, visitor_hash)
  values (today, p_slot, p_key, p_kind, p_visitor_hash)
  on conflict do nothing;
  get diagnostics counted = row_count;
  if counted = 0 then
    return false;
  end if;

  insert into public.sponsor_stats as stats (day, slot, sponsor_key, views, clicks)
  values (today, p_slot, p_key, (p_kind = 'view')::integer, (p_kind = 'click')::integer)
  on conflict (day, slot, sponsor_key) do update
    set views = stats.views + excluded.views,
        clicks = stats.clicks + excluded.clicks;
  return true;
end;
$$;

revoke execute on function public.record_sponsor_event(text, text, text, text) from public, anon, authenticated;
grant execute on function public.record_sponsor_event(text, text, text, text) to service_role;

-- The totals of each placement between two days (both included, a year at most), for the super admin.
create function public.admin_sponsor_report(p_from date, p_to date)
returns table (slot text, sponsor_key text, views bigint, clicks bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select public.is_super_admin()) then
    raise exception 'sponsor_report.not_allowed' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then
    raise exception 'sponsor_report.range' using errcode = '22023';
  end if;
  return query
  select stats.slot, stats.sponsor_key, sum(stats.views)::bigint, sum(stats.clicks)::bigint
  from public.sponsor_stats as stats
  where stats.day between p_from and p_to
  group by stats.slot, stats.sponsor_key
  order by stats.slot, sum(stats.views) desc, stats.sponsor_key;
end;
$$;

revoke execute on function public.admin_sponsor_report(date, date) from public, anon, authenticated;
grant execute on function public.admin_sponsor_report(date, date) to authenticated, service_role;
