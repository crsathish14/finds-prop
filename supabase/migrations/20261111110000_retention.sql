-- F11 retention (S7-T12 part 2, DEC-28, ADR-124): old personal data and old bookkeeping rows are deleted every night.
-- `run_retention()` deletes, in small batches so no run holds a table for long:
--   form_submissions, crm_api_logs, project_events   older than 12 months
--   enquiries, project_leads                         older than 24 months
--   public_rate_limits                               windows older than 7 days
--   idempotency_keys                                 older than 24 hours
-- A submission that still has uploaded files (their storage objects need their own step) or that is still waiting on a
-- CRM delivery is left alone and counted as skipped. The audit log is never pruned (it is append-only). Every run writes
-- one `retention.ran` entry holding the counts and nothing else. The windows are the constants below: changing one is a
-- new migration (and a new ADR line), so the log of changes is the repository's.
-- It runs as its owner (a definer function with a pinned search_path) and only the service role and the database's
-- own job may run it: nothing a visitor or a signed-in user holds can call it. A second run that starts while one is
-- still going leaves at once. Scheduled with pg_cron at 03:00 India time (21:30 UTC) every day.
-- Rollback note: nothing here is destructive until it runs, and the rows it deletes are not recoverable by design.
-- To stop it: `select cron.unschedule('retention');` (docs/runbooks/retention.md). To remove it: unschedule it and drop the
-- function, or fix forward with a new migration.

create function public.run_retention(p_batch integer default 5000, p_max_batches integer default 20)
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
      where candidate.window_start < now() - rate_limits_keep
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

-- Every night at 03:00 in India (21:30 UTC). Scheduling again under the same name replaces the job.
select cron.schedule('retention', '30 21 * * *', 'select public.run_retention()');
