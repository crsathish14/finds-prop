-- F07 follow-up: the audit log records which CRM connection a form sends its submissions to (S7-T12, ADR-123).
-- A form's `crm_integration_id` decides where a visitor's name, number and message are sent, so linking a form to a
-- connection, pointing it at another one, or unlinking it is recorded as `form.crm_changed`, with the actor as for the
-- other entries. The entry holds the two connection ids (the old one and the new one, null for none) and the form's id
-- as the entry's subject, nothing from the form or the connection. Deleting a connection unlinks its forms (the key is
-- set to null), and each of those forms gets an entry too, so the log shows every form that stopped sending to it.
-- Rollback note: nothing here is destructive. Drop the two triggers and the function, or fix forward with a new migration.

create function public.audit_form_crm()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.audit_write(
    'form.crm_changed', 'form', new.id::text,
    jsonb_build_object(
      'from', case when tg_op = 'INSERT' then null else old.crm_integration_id end,
      'to', new.crm_integration_id
    )
  );
  return null;
end;
$$;

revoke execute on function public.audit_form_crm() from public, anon, authenticated;

-- A form made already linked to a connection.
create trigger forms_audit_crm_insert
  after insert on public.forms
  for each row
  when (new.crm_integration_id is not null)
  execute function public.audit_form_crm();

-- A form linked, pointed at another connection, or unlinked.
create trigger forms_audit_crm_update
  after update on public.forms
  for each row
  when (old.crm_integration_id is distinct from new.crm_integration_id)
  execute function public.audit_form_crm();
