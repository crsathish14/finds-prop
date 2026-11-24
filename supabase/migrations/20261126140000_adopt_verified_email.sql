-- One address, not two (ADR-196, customer email plan PR 2, owner decisions 24 Nov 2026).
-- When a customer confirms their account email, that same address becomes the private address enquiries are mailed
-- to (profiles.contact_email, ADR-186), if they have none yet. They then type one address, not two.
-- adopt_verified_email_as_contact() takes no argument: it reads the confirmed address of the caller from auth.users
-- itself, so a client cannot hand it a different one. It never overwrites a contact email the person chose, and it
-- applies the same address rules as set_contact_email(): trimmed, lower case, at most 254 characters, shaped like an
-- address, and not one of the reserved admin addresses. When any of that is not met it does nothing and says false;
-- it raises only for a caller with no session or no verified phone, like every other owner write.
-- Answers true when it stored the address, false otherwise. The address is never in the answer.
-- Rollback note: nothing else reads the function. To undo, drop it: `drop function
-- public.adopt_verified_email_as_contact();`. Addresses already copied stay (they are ordinary contact emails).

create function public.adopt_verified_email_as_contact()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller constant uuid := (select auth.uid());
  confirmed text;
begin
  if caller is null or not (select public.has_verified_phone()) then
    raise exception 'profile.not_allowed' using errcode = '42501';
  end if;

  select lower(btrim(account.email)) into confirmed
  from auth.users as account
  where account.id = caller and account.email_confirmed_at is not null;

  if confirmed is null
    or char_length(confirmed) > 254
    or confirmed !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    or public.is_reserved_admin_email(confirmed)
  then
    return false;
  end if;

  update public.profiles
  set contact_email = confirmed
  where id = caller and contact_email is null;
  return found;
end;
$$;

revoke execute on function public.adopt_verified_email_as_contact() from public, anon, authenticated;
grant execute on function public.adopt_verified_email_as_contact() to authenticated, service_role;
