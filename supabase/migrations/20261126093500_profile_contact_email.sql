-- The poster's private contact email (ADR-184, enquiry email plan PR 2, owner approval 24 Nov 2026).
-- A home owner signs in by phone and has no email on the account, but the poster of a home is to be told by email
-- when someone enquires. The address is kept on the profile, apart from the sign-in email: it is not verified, it
-- is never public, and it is never part of the Supabase email flow (FLAG_CUSTOMER_EMAIL).
--
-- Who may read it: the profiles policies already let a person read their own row and the super admin read every
-- row, and the table-level `select` grant already covers a new column, so nothing is added there. Anon has no
-- grant on profiles at all. Nobody else, no public function and no view returns it.
-- Who may write it: nobody directly. The `update` grant on profiles stays `full_name` only, so a person cannot set
-- the column with an `update`. The one write path is `set_contact_email(p_email)` below, which is SECURITY DEFINER,
-- acts on the caller's own row only (`auth.uid()`), needs a verified phone like every other owner write, and
-- cleans and checks the address. No service role is used.
-- Rollback note: dropping the function and the column is safe while nothing sends mail (the later PRs of the plan
-- read the column): `drop function public.set_contact_email(text); alter table public.profiles drop column
-- contact_email;`. Fix forward with a new migration once mail reads it.

alter table public.profiles
  add column contact_email text;

alter table public.profiles
  add constraint profiles_contact_email_check check (
    contact_email is null
    or (
      char_length(contact_email) <= 254
      and contact_email = lower(contact_email)
      and contact_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    )
  );

comment on column public.profiles.contact_email is
  'Private. Where enquiries about this person''s homes are mailed (ADR-184). Not verified. Written only by set_contact_email().';

-- Sets or clears the caller's contact email. An empty value clears it. The address is trimmed and lowercased; one
-- that is not an address, is longer than 254 characters, or is one of the reserved admin addresses (ADR-010) is
-- refused. Answers the stored address, or null when it was cleared.
create function public.set_contact_email(p_email text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  cleaned text := lower(btrim(coalesce(p_email, '')));
begin
  if caller is null or not (select public.has_verified_phone()) then
    raise exception 'profile.not_allowed' using errcode = '42501';
  end if;
  if cleaned = '' then
    cleaned := null;
  elsif char_length(cleaned) > 254
    or cleaned !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'profile.contact_email_invalid' using errcode = '22023';
  elsif public.is_reserved_admin_email(cleaned) then
    raise exception 'profile.contact_email_reserved' using errcode = '22023';
  end if;
  update public.profiles set contact_email = cleaned where id = caller;
  if not found then
    raise exception 'profile.not_found' using errcode = 'P0002';
  end if;
  return cleaned;
end;
$$;

revoke execute on function public.set_contact_email(text) from public, anon, authenticated;
grant execute on function public.set_contact_email(text) to authenticated, service_role;
