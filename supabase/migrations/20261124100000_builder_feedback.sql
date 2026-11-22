-- Change request 22 Nov (plan 6): feedback from a builder or an agent to the super admin. Message only.
-- A builder (an agent too) sends a short plain-text message; the super admin reads every message with who sent it and
-- when, and marks it reviewed or not reviewed. Nobody else reads a message, not even the sender.
-- The table has no grants for anon or authenticated and no policies: every read and write goes through the four
-- functions below, which check the caller themselves (a builder sends, only the super admin lists and marks).
-- The text is never written to the audit log, only the id and who acted (like the content modules).
-- Rollback note: nothing here is destructive (a new table, four functions, two triggers). Fix forward with a new
-- migration.

create table public.builder_feedback (
  id uuid primary key default gen_random_uuid(),
  builder_id uuid not null references public.builders (id) on delete cascade,
  -- Plain text, at most 1000 characters; drawn as text, never as HTML.
  message text not null check (char_length(btrim(message)) between 1 and 1000),
  -- Empty means "not reviewed".
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.builder_feedback enable row level security;
revoke all on table public.builder_feedback from anon, authenticated;

-- The admin's list: newest first, and the not-reviewed filter.
create index builder_feedback_newest on public.builder_feedback (created_at desc, id desc);
create index builder_feedback_open on public.builder_feedback (created_at desc, id desc)
  where reviewed_at is null;
create index builder_feedback_by_builder on public.builder_feedback (builder_id);

-- A builder or an agent sends a message. The sender is the signed-in active builder, never a value the caller names.
create function public.submit_builder_feedback(p_message text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_builder uuid := (select public.current_builder_id());
  v_message text := btrim(coalesce(p_message, ''));
  v_id uuid;
begin
  if v_builder is null then
    raise exception 'feedback.not_allowed' using errcode = '42501';
  end if;
  if char_length(v_message) not between 1 and 1000 then
    raise exception 'feedback.invalid_message' using errcode = '23514';
  end if;
  insert into public.builder_feedback (builder_id, message) values (v_builder, v_message) returning id into v_id;
  return v_id;
end;
$$;

-- The super admin's list. `p_state` is 'all', 'open' (not reviewed) or 'reviewed'; anything else is refused. The page is
-- at most 100 rows; `total_count` is the number of matches before the page, on every row. Anyone who is not the super
-- admin gets no rows.
create function public.admin_feedback_list(
  p_state text default 'all',
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  builder_id uuid,
  builder_name text,
  builder_kind text,
  message text,
  created_at timestamptz,
  reviewed_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_state is null or p_state not in ('all', 'open', 'reviewed') then
    raise exception 'feedback.bad_state' using errcode = '22023';
  end if;
  return query
  select
    feedback.id, feedback.builder_id, builder.name, builder.kind, feedback.message, feedback.created_at,
    feedback.reviewed_at, count(*) over ()
  from public.builder_feedback as feedback
  join public.builders as builder on builder.id = feedback.builder_id
  where (select public.is_super_admin())
    and (p_state = 'all'
      or (p_state = 'open' and feedback.reviewed_at is null)
      or (p_state = 'reviewed' and feedback.reviewed_at is not null))
  order by feedback.created_at desc, feedback.id desc
  limit least(greatest(coalesce(p_limit, 25), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- The numbers beside the filters and the sidebar. Zeros for anyone who is not the super admin.
create function public.admin_feedback_counts()
returns table (total bigint, not_reviewed bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    count(*) filter (where (select public.is_super_admin())),
    count(*) filter (where feedback.reviewed_at is null and (select public.is_super_admin()))
  from public.builder_feedback as feedback
$$;

-- Marks one message reviewed or not reviewed. True when the message exists. Marking it reviewed again keeps the first
-- date. Only the super admin.
create function public.admin_set_feedback_reviewed(p_id uuid, p_reviewed boolean)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_found boolean;
begin
  if not (select public.is_super_admin()) then
    raise exception 'feedback.not_allowed' using errcode = '42501';
  end if;
  if p_reviewed is null then
    raise exception 'feedback.bad_state' using errcode = '22023';
  end if;
  update public.builder_feedback
  set reviewed_at = case when p_reviewed then coalesce(reviewed_at, now()) else null end
  where id = p_id;
  v_found := found;
  return v_found;
end;
$$;

revoke execute on function public.submit_builder_feedback(text) from public, anon, authenticated;
revoke execute on function public.admin_feedback_list(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.admin_feedback_counts() from public, anon, authenticated;
revoke execute on function public.admin_set_feedback_reviewed(uuid, boolean) from public, anon, authenticated;
grant execute on function public.submit_builder_feedback(text) to authenticated, service_role;
grant execute on function public.admin_feedback_list(text, integer, integer) to authenticated, service_role;
grant execute on function public.admin_feedback_counts() to authenticated, service_role;
grant execute on function public.admin_set_feedback_reviewed(uuid, boolean) to authenticated, service_role;

-- The audit entries: which message, who sent it, who reviewed it; never the text.
create function public.audit_builder_feedback()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.audit_write(
      'feedback.created', 'builder_feedback', new.id::text,
      jsonb_build_object('builder_id', new.builder_id)
    );
  else
    perform public.audit_write(
      case when new.reviewed_at is null then 'feedback.unreviewed' else 'feedback.reviewed' end,
      'builder_feedback', new.id::text,
      jsonb_build_object('builder_id', new.builder_id)
    );
  end if;
  return null;
end;
$$;

revoke execute on function public.audit_builder_feedback() from public, anon, authenticated;

create trigger builder_feedback_audit_insert
  after insert on public.builder_feedback
  for each row execute function public.audit_builder_feedback();

create trigger builder_feedback_audit_update
  after update on public.builder_feedback
  for each row
  when (old.reviewed_at is distinct from new.reviewed_at)
  execute function public.audit_builder_feedback();
