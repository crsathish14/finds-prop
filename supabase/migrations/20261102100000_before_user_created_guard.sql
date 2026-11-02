-- F02 follow-up: the Before User Created guard.
-- Rule BR-16 (proposed): only phone customers, the reserved administrators and invited builders can
-- create an account. Found by the auth spike (docs/runbooks/auth-spike.md, section F): while sign-ups
-- are on, any Google account could create an account.
-- Supabase Auth calls this function just before it creates a new account. It answers `{}` to allow,
-- or an error object to refuse. The function does nothing until the owner selects it under
-- Authentication, Hooks, Before User Created (docs/runbooks/before-user-created-hook.md).
-- It is an allow-list: a provider or a payload it does not know is refused. It never raises, because
-- an error inside a hook stops every sign-up with an internal error.
-- Reserved admins and invited builders are let in only through Google. An email sign-up with one of
-- their addresses is refused, so nobody can squat on an address before its owner arrives.
-- Rollback note: nothing here is destructive. Switch the hook off in the dashboard (it takes effect
-- at once), then fix forward with a new migration.

create function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  provider text := lower(coalesce(event -> 'user' -> 'app_metadata' ->> 'provider', ''));
  address text := nullif(btrim(coalesce(event -> 'user' ->> 'email', '')), '');
begin
  -- Customers sign in with a phone code.
  if provider = 'phone' then
    return '{}'::jsonb;
  end if;

  -- Staff sign in with Google, and only an address we already know may do so.
  if provider = 'google' and address is not null then
    if public.is_reserved_admin_email(address) then
      return '{}'::jsonb;
    end if;
    if exists (
      select 1 from public.builders as builder
      where lower(builder.email) = lower(address) and builder.active
    ) then
      return '{}'::jsonb;
    end if;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object('http_code', 403, 'message', 'signup_not_allowed')
  );
end;
$$;

-- Only Supabase Auth may call it; nobody else needs to, and it must not be callable through the API.
revoke execute on function public.hook_before_user_created(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
-- The Auth service reaches the function through the schema, as Supabase's hook guides show.
grant usage on schema public to supabase_auth_admin;
