-- F06 enquiries (S5-T03, part 1): the function that stores an enquiry.
-- Rules: BR-50 (an enquiry is stored for the caller's own account, never for a user named by the
-- browser), BR-51/52 (the owner moves it forward only; that is the existing guard), DEC-26 (one
-- enquiry per user per home per 24 hours). Enquiries have no client insert (F06). This function is the
-- only way in, and only the server may call it: the server action has already checked that the caller
-- is signed in with a verified phone, taken the user id and the phone from the account, and counted
-- the rate limit (10 per user per day), so execute is granted to service_role alone and a signed-in
-- user cannot call it directly with another user's id.
-- Rollback note: drop the function; nothing else changes. Fix forward with a new migration.

-- Stores one enquiry and returns its id. The home is named by its public short id. A home that is not
-- approved, or does not exist, looks the same ("project_not_found" style): P0002. The owner may not
-- enquire about their own home. A second enquiry about the same home by the same user within 24 hours
-- is refused as a duplicate (unique_violation) and stores nothing; the same user and home are
-- serialised, so two requests at once cannot both pass the check. The phone arrives as digits only
-- (6 to 15); empty email and message are stored as null; the table's own checks refuse a name outside
-- 2 to 80 characters, a bad phone and an over-long email or message (check_violation).
create function public.submit_enquiry(
  p_short_id text,
  p_user_id uuid,
  p_name text,
  p_phone text,
  p_email text default null,
  p_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
  owner_user uuid;
  enquiry_id uuid;
begin
  if p_user_id is null then
    raise exception 'enquiry.user' using errcode = '22023';
  end if;

  select id, owner_id into target, owner_user
  from public.properties
  where short_id = p_short_id and status = 'approved';
  if target is null then
    raise exception 'enquiry.property_not_found' using errcode = 'P0002';
  end if;
  if owner_user = p_user_id then
    raise exception 'enquiry.own_listing' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || target::text, 0));
  if exists (
    select 1
    from public.enquiries
    where property_id = target
      and user_id = p_user_id
      and created_at > now() - interval '24 hours'
  ) then
    raise exception 'enquiry.duplicate' using errcode = '23505';
  end if;

  insert into public.enquiries (property_id, user_id, name, phone, email, message)
  values (
    target,
    p_user_id,
    btrim(p_name),
    p_phone,
    nullif(btrim(p_email), ''),
    nullif(btrim(p_message), '')
  )
  returning id into enquiry_id;
  return enquiry_id;
end;
$$;

revoke execute on function public.submit_enquiry(text, uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.submit_enquiry(text, uuid, text, text, text, text)
  to service_role;
