-- AI chat P1-T04a (ADR-128 section 7, D9, D13): the free trial of 2 messages is counted over one year.
-- Two things stopped that, and this migration changes both, forward-only:
--   1. rate_limit_hit refused any window over one day (86400 s). It now accepts up to 366 days (31622400 s). Nothing
--      else about it changes (same arguments, same atomic upsert, same answer, same grants).
--   2. run_retention deleted every public_rate_limits window older than 7 days, so a yearly counter would have been
--      wiped within a week. It now keeps the rows of the two trial scopes, `ai_chat_trial_cookie` and
--      `ai_chat_trial_visitor` (the scope name plus the "who" the application adds), for 400 days from the window
--      start (a 366-day window plus a margin). Every other scope is still swept after 7 days. The rest of
--      run_retention is copied unchanged from 20261111110000_retention.sql, as docs/runbooks/retention.md says to do.
-- Rollback note: nothing here is destructive. To undo, fix forward with a new migration that restores the 86400 cap and
-- the single 7-day rule; trial rows already written would then be swept by the next nightly run. The retention job
-- schedule is not touched.

create or replace function public.rate_limit_hit(
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
  if window_seconds < 1 or window_seconds > 31622400 or max_hits < 1 then
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

create or replace function public.run_retention(p_batch integer default 5000, p_max_batches integer default 20)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- DEC-28 (provisional until counsel confirms; ADR-124).
  submissions_keep constant interval := interval '12 months';
  logs_keep constant interval := interval '12 months';
  events_keep constant interval := interval '12 months';
  enquiries_keep constant interval := interval '24 months';
  leads_keep constant interval := interval '24 months';
  rate_limits_keep constant interval := interval '7 days';
  -- The AI chat trial counts over one year (window of 366 days), so its rows are kept 400 days from the window start.
  trial_keep constant interval := interval '400 days';
  idempotency_keep constant interval := interval '24 hours';
  gone integer;
  batches integer;
  submissions_gone integer := 0;
  logs_gone integer := 0;
  events_gone integer := 0;
  enquiries_gone integer := 0;
  leads_gone integer := 0;
  rate_limits_gone integer := 0;
  idempotency_gone integer := 0;
  with_files integer;
  still_pending integer;
  result jsonb;
begin
  if p_batch is null or p_batch < 1 or p_max_batches is null or p_max_batches < 1 then
    raise exception 'retention.bad_limits' using errcode = '22023';
  end if;
  -- One run at a time: a manual run that meets the nightly one leaves.
  if not pg_try_advisory_xact_lock(hashtext('retention')) then
    return jsonb_build_object('busy', true);
  end if;

  -- Form submissions: not those with uploaded files, and not those still waiting on a CRM delivery.
  batches := 0;
  loop
    delete from public.form_submissions
    where ctid in (
      select candidate.ctid from public.form_submissions as candidate
      where candidate.created_at < now() - submissions_keep
        and jsonb_array_length(candidate.files) = 0
        and candidate.crm_status <> 'pending'
      limit p_batch
    );
    get diagnostics gone = row_count;
    submissions_gone := submissions_gone + gone;
    batches := batches + 1;
    exit when gone < p_batch or batches >= p_max_batches;
  end loop;
  select count(*) filter (where jsonb_array_length(files) > 0),
         count(*) filter (where jsonb_array_length(files) = 0 and crm_status = 'pending')
  into with_files, still_pending
  from public.form_submissions
  where created_at < now() - submissions_keep;

  batches := 0;
  loop
    delete from public.crm_api_logs
    where ctid in (
      select candidate.ctid from public.crm_api_logs as candidate
      where candidate.created_at < now() - logs_keep
      limit p_batch
    );
    get diagnostics gone = row_count;
    logs_gone := logs_gone + gone;
    batches := batches + 1;
    exit when gone < p_batch or batches >= p_max_batches;
  end loop;

  batches := 0;
  loop
    delete from public.project_events
    where ctid in (
      select candidate.ctid from public.project_events as candidate
      where candidate.created_at < now() - events_keep
      limit p_batch
    );
    get diagnostics gone = row_count;
    events_gone := events_gone + gone;
    batches := batches + 1;
    exit when gone < p_batch or batches >= p_max_batches;
  end loop;

  batches := 0;
  loop
    delete from public.enquiries
    where ctid in (
      select candidate.ctid from public.enquiries as candidate
      where candidate.created_at < now() - enquiries_keep
      limit p_batch
    );
    get diagnostics gone = row_count;
    enquiries_gone := enquiries_gone + gone;
    batches := batches + 1;
    exit when gone < p_batch or batches >= p_max_batches;
  end loop;

  batches := 0;
  loop
    delete from public.project_leads
    where ctid in (
      select candidate.ctid from public.project_leads as candidate
      where candidate.created_at < now() - leads_keep
      limit p_batch
    );
    get diagnostics gone = row_count;
    leads_gone := leads_gone + gone;
    batches := batches + 1;
    exit when gone < p_batch or batches >= p_max_batches;
  end loop;

  batches := 0;
  loop
    delete from public.public_rate_limits
    where ctid in (
      select candidate.ctid from public.public_rate_limits as candidate
      where case
        when candidate.scope in ('ai_chat_trial_cookie', 'ai_chat_trial_visitor')
          then candidate.window_start < now() - trial_keep
        else candidate.window_start < now() - rate_limits_keep
      end
      limit p_batch
    );
    get diagnostics gone = row_count;
    rate_limits_gone := rate_limits_gone + gone;
    batches := batches + 1;
    exit when gone < p_batch or batches >= p_max_batches;
  end loop;

  batches := 0;
  loop
    delete from public.idempotency_keys
    where ctid in (
      select candidate.ctid from public.idempotency_keys as candidate
      where candidate.created_at < now() - idempotency_keep
      limit p_batch
    );
    get diagnostics gone = row_count;
    idempotency_gone := idempotency_gone + gone;
    batches := batches + 1;
    exit when gone < p_batch or batches >= p_max_batches;
  end loop;

  result := jsonb_build_object(
    'form_submissions', submissions_gone,
    'crm_api_logs', logs_gone,
    'project_events', events_gone,
    'enquiries', enquiries_gone,
    'project_leads', leads_gone,
    'public_rate_limits', rate_limits_gone,
    'idempotency_keys', idempotency_gone,
    'skipped', jsonb_build_object('form_submissions_with_files', with_files, 'form_submissions_pending', still_pending)
  );
  -- Counts only: no id, name, number or message goes into the log.
  perform public.audit_write('retention.ran', 'retention', null, result);
  return result;
end;
$$;

revoke execute on function public.run_retention(integer, integer) from public, anon, authenticated;
grant execute on function public.run_retention(integer, integer) to service_role;
