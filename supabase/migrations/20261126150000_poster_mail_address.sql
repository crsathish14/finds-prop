-- Where the poster mail of a home goes (ADR-198, customer email plan, owner decision 24 Nov 2026: "all recommended").
-- The poster of a home is mailed at their private contact email (profiles.contact_email, ADR-186). A person who has
-- confirmed an account email (ADR-195, ADR-196) should not need a second address for the same purpose, so when there
-- is no contact email the mail goes to the confirmed account email instead. A contact email the person chose always
-- wins, and an account email that is not confirmed is never used.
-- poster_mail_address(p_owner) is for the server only: the enquiry mail reads it with the service role after the
-- visitor's request has ended, because both addresses are private (a person reads only their own row and nobody
-- can read auth.users). It answers one address, lower case, or null; the same shape and reserved-address rules as
-- set_contact_email() apply to the account email, since that address was not typed into our own form.
-- Rollback note: nothing is stored. To undo, drop the function and have the mail read profiles.contact_email only
-- again; fix forward with a new migration.

create function public.poster_mail_address(p_owner uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select profile.contact_email from public.profiles as profile where profile.id = p_owner),
    (
      select lower(btrim(account.email))
      from auth.users as account
      where account.id = p_owner
        and account.email_confirmed_at is not null
        and char_length(lower(btrim(account.email))) <= 254
        and lower(btrim(account.email)) ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
        and not public.is_reserved_admin_email(lower(btrim(account.email)))
    )
  )
$$;

revoke execute on function public.poster_mail_address(uuid) from public, anon, authenticated;
grant execute on function public.poster_mail_address(uuid) to service_role;
