-- F05 follow-up: the CRM delivery state machine (S7-T09 part B1, FR-ADM-09, BR-66, ADR-114).
-- A form submission to a form with a CRM connection starts 'pending'. The server sends it, and the database keeps the
-- rules that must not depend on one server run being right: who may be sent now, that two runs never send the same
-- lead (a claim with a short lease), what a result does to the submission, and the log line written with it.
--  - claim_crm_deliveries picks the submissions that are due (pending for over a minute, or failed with a retry time
--    that has come), or one named submission, locks them with `skip locked`, leases them for 5 minutes and returns what
--    the sender needs. A submission whose connection is inactive is left as it is and is sent once the connection is on
--    again. A submission whose connection was deleted can never be sent: it becomes 'not_applicable'.
--  - record_crm_delivery writes the log line and the submission's new state together. A success keeps the lead id; a
--    failure keeps the reason and the next retry time (BR-66: 1, 5, 30, 120 and 720 minutes, six attempts in all, the
--    times come from the server and are checked here), and after the sixth attempt there is no next time.
-- Both are for the service role alone: the retry route and the form actions call them. The lease is a column of its own
-- so that `next_retry_at` stays the real schedule the leads page shows.
-- Rollback note: drop both functions and the two indexes; the column can be dropped (`alter table public.form_submissions
-- drop column crm_claimed_until`) once nothing reads it. Submissions already sent keep their state.

alter table public.form_submissions
  add column crm_claimed_until timestamptz;

-- The retry sweep looks for pending submissions older than a minute, and for connections that were deleted.
create index form_submissions_pending on public.form_submissions (created_at)
  where crm_status = 'pending';
create index form_submissions_orphaned on public.form_submissions (id)
  where crm_status in ('pending', 'failed') and crm_integration_id is null;

create function public.claim_crm_deliveries(p_limit integer default 10, p_submission uuid default null)
returns table (
  submission_id uuid,
  integration_id uuid,
  attempt smallint,
  form_name text,
  project_id uuid,
  project_name text,
  project_slug text,
  name text,
  mobile text,
  email text,
  data jsonb,
  source text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_limit is null or p_limit not between 1 and 50 then
    raise exception 'crm.bad_limit' using errcode = '22023';
  end if;

  -- A connection that was deleted leaves its submissions with nowhere to go.
  if p_submission is null then
    update public.form_submissions as lost
    set crm_status = 'not_applicable', next_retry_at = null, crm_claimed_until = null,
        last_error = 'The connection was deleted.'
    where lost.crm_status in ('pending', 'failed') and lost.crm_integration_id is null;
  end if;

  return query
  with due as (
    select sub.id
    from public.form_submissions as sub
    join public.crm_integrations as crm on crm.id = sub.crm_integration_id and crm.active
    where (sub.crm_claimed_until is null or sub.crm_claimed_until <= now())
      and (
        (p_submission is not null and sub.id = p_submission and sub.crm_status in ('pending', 'failed'))
        or (
          p_submission is null
          and (
            (sub.crm_status = 'pending' and sub.created_at <= now() - interval '1 minute')
            or (sub.crm_status = 'failed' and sub.next_retry_at is not null and sub.next_retry_at <= now())
          )
        )
      )
    order by sub.created_at, sub.id
    limit p_limit
    for update of sub skip locked
  ),
  claimed as (
    -- Named by the caller means "send now" (the first try, or the admin's retry): the schedule starts again.
    update public.form_submissions as target
    set crm_claimed_until = now() + interval '5 minutes',
        crm_attempts = case when p_submission is not null then 0 else target.crm_attempts end
    from due
    where target.id = due.id
    returning target.id, target.crm_integration_id, target.crm_attempts, target.form_name, target.project_id,
      target.name, target.mobile, target.email, target.data, target.source, target.created_at
  )
  select
    claimed.id,
    claimed.crm_integration_id,
    (claimed.crm_attempts + 1)::smallint,
    claimed.form_name,
    claimed.project_id,
    project.name,
    project.slug,
    claimed.name,
    claimed.mobile,
    claimed.email,
    claimed.data,
    claimed.source,
    claimed.created_at
  from claimed
  left join public.projects as project on project.id = claimed.project_id
  order by claimed.created_at, claimed.id;
end;
$$;

create function public.record_crm_delivery(
  p_submission uuid,
  p_integration_name text,
  p_attempt integer,
  p_ok boolean,
  p_http_status integer default null,
  p_snippet text default null,
  p_lead_id text default null,
  p_next_retry timestamptz default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.form_submissions%rowtype;
  status_code constant smallint := case when p_http_status between 100 and 599 then p_http_status::smallint end;
  note constant text := nullif(left(btrim(coalesce(p_snippet, '')), 500), '');
  next_state text;
begin
  if p_attempt is null or p_attempt not between 1 and 6 or p_ok is null then
    raise exception 'crm.bad_attempt' using errcode = '22023';
  end if;
  if not p_ok and p_attempt < 6
    and (p_next_retry is null or p_next_retry <= now() - interval '1 minute' or p_next_retry > now() + interval '1 day')
  then
    raise exception 'crm.bad_retry_time' using errcode = '22023';
  end if;

  select * into target from public.form_submissions as sub where sub.id = p_submission for update;
  if not found then
    raise exception 'crm.submission_not_found' using errcode = 'P0002';
  end if;

  insert into public.crm_api_logs (
    integration_id, integration_name, submission_id, form_name, outcome, http_status, attempt, response_snippet
  )
  values (
    target.crm_integration_id,
    left(coalesce(nullif(btrim(p_integration_name), ''), 'CRM'), 120),
    target.id,
    target.form_name,
    case when p_ok then 'success' else 'failed' end,
    status_code,
    p_attempt,
    note
  );

  next_state := case when p_ok then 'success' else 'failed' end;
  update public.form_submissions as sub
  set crm_status = next_state,
      crm_attempts = p_attempt,
      crm_http_status = status_code,
      crm_lead_id = case when p_ok then left(nullif(btrim(coalesce(p_lead_id, '')), ''), 120) else sub.crm_lead_id end,
      next_retry_at = case when p_ok or p_attempt >= 6 then null else p_next_retry end,
      last_error = case when p_ok then null else coalesce(note, 'The CRM did not accept the lead.') end,
      crm_claimed_until = null
  where sub.id = target.id;

  return next_state;
end;
$$;

revoke execute on function public.claim_crm_deliveries(integer, uuid) from public, anon, authenticated;
revoke execute on function public.record_crm_delivery(uuid, text, integer, boolean, integer, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.claim_crm_deliveries(integer, uuid) to service_role;
grant execute on function public.record_crm_delivery(uuid, text, integer, boolean, integer, text, text, timestamptz)
  to service_role;
