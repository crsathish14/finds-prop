-- F04 follow-up: the builder type, so the admin can tell a builder from an agent.
-- Owner decision, 1 Nov 2026: an agent works exactly like a builder (same invitation, Google
-- sign-in, portal and rules) but the admin must know which is which, because payment differs.
-- Both hold the `builder` role for access, so the type has one home: builders.kind. The `agent`
-- value of the role enum stays unused (DEC-08). The type is private: it is not in any column grant
-- (visitors and builders cannot read it), a builder cannot change it, and a change is recorded in
-- the audit log. Billing itself is not designed and not built here.
-- Rollback note: nothing here is destructive. Fix forward with a new migration.

alter table public.builders
  add column kind text not null default 'builder' check (kind in ('builder', 'agent'));

-- The guard now also keeps the type out of a builder's hands.
create or replace function public.guard_builders()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_reserved_admin_email(new.email) then
    raise exception 'builders.reserved_email';
  end if;
  if tg_op = 'INSERT' then
    return new;
  end if;
  if current_user not in ('postgres', 'supabase_admin', 'service_role')
    and not (select public.is_super_admin())
    and (new.user_id, new.email, new.active, new.invited_at, new.onboarded_at, new.kind)
      is distinct from
       (old.user_id, old.email, old.active, old.invited_at, old.onboarded_at, old.kind)
  then
    raise exception 'builders.admin_only_columns';
  end if;
  return new;
end;
$$;

-- A change of type is recorded; the email address is still never written down.
create or replace function public.audit_builders()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.audit_write('builder.created', 'builder', new.id::text, jsonb_build_object('kind', new.kind));
    return null;
  end if;
  if new.active is distinct from old.active then
    perform public.audit_write(
      case when new.active then 'builder.activated' else 'builder.deactivated' end,
      'builder', new.id::text, '{}'::jsonb
    );
  end if;
  if lower(new.email) is distinct from lower(old.email) then
    perform public.audit_write('builder.email_changed', 'builder', new.id::text, '{}'::jsonb);
  end if;
  if new.kind is distinct from old.kind then
    perform public.audit_write(
      'builder.kind_changed', 'builder', new.id::text, jsonb_build_object('from', old.kind, 'to', new.kind)
    );
  end if;
  return null;
end;
$$;
