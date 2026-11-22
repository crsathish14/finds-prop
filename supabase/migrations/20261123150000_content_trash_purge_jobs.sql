-- ADR-146 (ADR-143 D3, ADR-147, ADR-124): the nightly retention job also purges job postings that have been in Trash for
-- more than 30 days. Careers merged after the Trash purge (20261121110000_content_trash_purge.sql), so until now a
-- trashed job was never deleted: no client holds the DELETE privilege on `job_postings`, and this job is the only thing
-- that ever deletes such a row.
-- The only change is one name added to the list `content_trash_tables` (faqs, blog_posts, job_postings), as that
-- migration says to do. The batched delete, the 30 days (`content_trash_keep`), the `content.purged` audit entry and the
-- `retention.ran` counts all come from the list, so the answer and the entry gain one more count, `job_postings`.
-- Only a row with a `deleted_at` older than 30 days goes. A job that is open, a draft or closed and not in Trash is never
-- touched, however old; a trashed job is always a draft or closed (a check says so), so no open job can be purged.
-- A job owns no file: people apply on another site or by email (ADR-143 D4, ADR-147) and the platform stores no
-- upload for it, so there is nothing to sweep in the Storage service, unlike an article's pictures.
-- `run_retention` is replaced whole, as the runbook says to do: everything else is copied unchanged from
-- 20261121110000_content_trash_purge.sql. Same arguments, same grants, same schedule, so no type changes.
-- Rollback note: not destructive until it runs; rows it purges are not recoverable by design. To undo, fix forward with
-- a new migration that restores the previous list (`faqs`, `blog_posts`).

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
  -- AI chat usage metadata (ADR-128 section 8): no text, but a user id or a visitor hash, so it is not kept forever.
  ai_usage_keep constant interval := interval '12 months';
  -- Place search usage counts (ADR-134): counts only, no personal data. Provisional until the owner confirms 24 months.
  places_usage_keep constant interval := interval '24 months';
  idempotency_keep constant interval := interval '24 hours';
  -- Content in Trash (ADR-143 D3, ADR-146): kept this long after `deleted_at`, then purged. The tables are the ones
  -- with a `deleted_at` column and an `id` column; to add one, add its name here and nowhere else.
  content_trash_keep constant interval := interval '30 days';
  content_trash_tables constant text[] := array['faqs', 'blog_posts', 'job_postings'];
  content_table text;
  content_ids text[];
  content_batch_ids text[];
  content_gone integer;
  content_counts jsonb := '{}'::jsonb;
  gone integer;
  batches integer;
  submissions_gone integer := 0;
  logs_gone integer := 0;
  events_gone integer := 0;
  enquiries_gone integer := 0;
  leads_gone integer := 0;
  rate_limits_gone integer := 0;
  idempotency_gone integer := 0;
  ai_usage_gone integer := 0;
  places_usage_gone integer := 0;
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

  batches := 0;
  loop
    delete from public.ai_usage_events
    where ctid in (
      select candidate.ctid from public.ai_usage_events as candidate
      where candidate.occurred_at < now() - ai_usage_keep
      limit p_batch
    );
    get diagnostics gone = row_count;
    ai_usage_gone := ai_usage_gone + gone;
    batches := batches + 1;
    exit when gone < p_batch or batches >= p_max_batches;
  end loop;

  batches := 0;
  loop
    delete from public.places_usage_daily
    where ctid in (
      select candidate.ctid from public.places_usage_daily as candidate
      where candidate.day < ((now() at time zone 'Asia/Kolkata')::date - places_usage_keep)::date
      limit p_batch
    );
    get diagnostics gone = row_count;
    places_usage_gone := places_usage_gone + gone;
    batches := batches + 1;
    exit when gone < p_batch or batches >= p_max_batches;
  end loop;

  -- Content in Trash for more than 30 days, one table at a time. The names come from the constant list above, never
  -- from a caller, and `%I` quotes them anyway.
  foreach content_table in array content_trash_tables loop
    content_ids := '{}';
    content_gone := 0;
    batches := 0;
    loop
      execute format(
        'with purged as ('
        || 'delete from public.%I where ctid in ('
        || 'select candidate.ctid from public.%I as candidate where candidate.deleted_at < now() - $1 limit $2'
        || ') returning id'
        || ') select coalesce(array_agg(purged.id::text), array[]::text[]) from purged',
        content_table, content_table
      ) into content_batch_ids using content_trash_keep, p_batch;
      gone := coalesce(cardinality(content_batch_ids), 0);
      content_gone := content_gone + gone;
      if cardinality(content_ids) < 500 then
        content_ids := content_ids || content_batch_ids;
      end if;
      batches := batches + 1;
      exit when gone < p_batch or batches >= p_max_batches;
    end loop;
    content_counts := content_counts || jsonb_build_object(content_table, content_gone);
    if content_gone > 0 then
      -- Names, counts and ids only: no title, question, answer or other text.
      perform public.audit_write(
        'content.purged', 'content', null,
        jsonb_build_object(
          'table', content_table,
          'count', content_gone,
          'older_than_days', extract(day from content_trash_keep)::integer,
          'ids', to_jsonb(content_ids[1:500])
        )
      );
    end if;
  end loop;

  result := content_counts || jsonb_build_object(
    'form_submissions', submissions_gone,
    'crm_api_logs', logs_gone,
    'project_events', events_gone,
    'enquiries', enquiries_gone,
    'project_leads', leads_gone,
    'public_rate_limits', rate_limits_gone,
    'idempotency_keys', idempotency_gone,
    'ai_usage_events', ai_usage_gone,
    'places_usage_daily', places_usage_gone,
    'skipped', jsonb_build_object('form_submissions_with_files', with_files, 'form_submissions_pending', still_pending)
  );
  -- Counts only: no id, name, number or message goes into the log.
  perform public.audit_write('retention.ran', 'retention', null, result);
  return result;
end;
$$;

revoke execute on function public.run_retention(integer, integer) from public, anon, authenticated;
grant execute on function public.run_retention(integer, integer) to service_role;
