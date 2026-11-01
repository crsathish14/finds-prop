-- F07 platform, part 1: the "too many tries" counter and the duplicate-submission keys.
-- Rules: BR-61, BR-70 to BR-72 (rate limits by visitor hash), plan 07 section 11 (OTP, enquiry,
-- listing, upload and search limits), ADR-018. Only the service role (and functions it calls) can
-- use these tables; a signed-in user must never be able to spend another person's allowance.
-- Old counter rows and old keys are swept by the retention migration (F11).
-- Rollback note: nothing here is destructive. Fix forward with a new migration.

create table public.public_rate_limits (
  scope text not null check (scope ~ '^[a-z][a-z0-9_]*$' and char_length(scope) <= 40),
  subject_hash text not null check (char_length(subject_hash) between 8 and 128),
  window_start timestamptz not null,
  hits integer not null default 0 check (hits >= 0),
  primary key (scope, subject_hash, window_start)
);

alter table public.public_rate_limits enable row level security;

-- The retention sweep of old windows.
create index public_rate_limits_by_window on public.public_rate_limits (window_start);

-- Counts one attempt in the current fixed window and says whether it is still allowed. The count
-- and the answer come from one atomic statement, so two requests at once cannot both slip through.
create function public.rate_limit_hit(
  limit_scope text,
  limit_subject text,
  window_seconds integer,
  max_hits integer
)
returns table (allowed boolean, retry_after integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  window_begin timestamptz;
  current_hits integer;
begin
  if window_seconds < 1 or window_seconds > 86400 or max_hits < 1 then
    raise exception 'rate_limit.invalid_arguments';
  end if;
  window_begin := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / window_seconds) * window_seconds
  );
  insert into public.public_rate_limits as counter (scope, subject_hash, window_start, hits)
  values (limit_scope, limit_subject, window_begin, 1)
  on conflict (scope, subject_hash, window_start) do update set hits = counter.hits + 1
  returning counter.hits into current_hits;

  allowed := current_hits <= max_hits;
  if allowed then
    retry_after := 0;
  else
    retry_after := greatest(
      1,
      ceil(extract(epoch from (window_begin + make_interval(secs => window_seconds) - clock_timestamp())))::integer
    );
  end if;
  return next;
end;
$$;

revoke execute on function public.rate_limit_hit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, text, integer, integer) to service_role;

-- One row per (scope, subject, key): a repeated submission finds its row and returns the stored result.
create table public.idempotency_keys (
  scope text not null check (scope ~ '^[a-z][a-z0-9_]*$' and char_length(scope) <= 40),
  subject text not null check (char_length(subject) between 1 and 128),
  key uuid not null,
  result jsonb,
  created_at timestamptz not null default now(),
  primary key (scope, subject, key)
);

alter table public.idempotency_keys enable row level security;

-- The 24 hour sweep.
create index idempotency_keys_by_age on public.idempotency_keys (created_at);

revoke all on table public.public_rate_limits from anon, authenticated;
revoke all on table public.idempotency_keys from anon, authenticated;
