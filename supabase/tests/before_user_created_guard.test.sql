-- F02 follow-up: the Before User Created guard. Tests: DB-FN-hook_before_user_created (BR-16).
begin;
select plan(24);

-- A sign-up event as Supabase Auth builds it, reduced to the fields the guard reads.
create function pg_temp.sign_up_event(provider text, address text default null)
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'metadata', jsonb_build_object('name', 'before-user-created'),
    'user', jsonb_build_object(
      'email', address,
      'app_metadata', jsonb_build_object('provider', provider, 'providers', jsonb_build_array(provider))
    )
  )
$$;

insert into public.builders (email, name) values ('invited@example.test', 'Invited Builder');
insert into public.builders (email, name, active) values ('paused@example.test', 'Paused Builder', false);

-- Allowed
select is(
  public.hook_before_user_created(pg_temp.sign_up_event('phone')),
  '{}'::jsonb,
  'a phone sign-up is allowed'
);
select is(
  public.hook_before_user_created(pg_temp.sign_up_event('google', 'developer@findsprop.com')),
  '{}'::jsonb,
  'the first reserved admin may sign in with Google'
);
select is(
  public.hook_before_user_created(pg_temp.sign_up_event('google', 'Support@DrizzleMarketings.com')),
  '{}'::jsonb,
  'the second reserved admin may sign in with Google, in any letter case'
);
select is(
  public.hook_before_user_created(pg_temp.sign_up_event('google', 'invited@example.test')),
  '{}'::jsonb,
  'an invited builder may sign in with Google'
);
select is(
  public.hook_before_user_created(pg_temp.sign_up_event('Google', 'INVITED@example.test')),
  '{}'::jsonb,
  'the provider and the address are compared ignoring letter case'
);

-- Refused
select is(
  public.hook_before_user_created(pg_temp.sign_up_event('google', 'stranger@example.test')) -> 'error' ->> 'http_code',
  '403',
  'a stranger with Google is refused with status 403'
);
select is(
  public.hook_before_user_created(pg_temp.sign_up_event('google', 'stranger@example.test')) -> 'error' ->> 'message',
  'signup_not_allowed',
  'the refusal carries a code, not a sentence'
);
select is(
  public.hook_before_user_created(pg_temp.sign_up_event('email', 'stranger@example.test')) -> 'error' ->> 'message',
  'signup_not_allowed',
  'an email sign-up is refused'
);
select is(
  public.hook_before_user_created(pg_temp.sign_up_event('email', 'developer@findsprop.com')) -> 'error' ->> 'message',
  'signup_not_allowed',
  'an email sign-up cannot take a reserved admin address'
);
select is(
  public.hook_before_user_created(pg_temp.sign_up_event('email', 'invited@example.test')) -> 'error' ->> 'message',
  'signup_not_allowed',
  'an email sign-up cannot take an invited builder address'
);
select is(
  public.hook_before_user_created(pg_temp.sign_up_event('google', 'paused@example.test')) -> 'error' ->> 'message',
  'signup_not_allowed',
  'a deactivated builder cannot create a new account'
);
select is(
  public.hook_before_user_created(pg_temp.sign_up_event('google')) -> 'error' ->> 'message',
  'signup_not_allowed',
  'a Google sign-up without an address is refused'
);
select is(
  public.hook_before_user_created(pg_temp.sign_up_event('google', '   ')) -> 'error' ->> 'message',
  'signup_not_allowed',
  'a blank address is refused'
);
select is(
  public.hook_before_user_created(pg_temp.sign_up_event('anonymous')) -> 'error' ->> 'message',
  'signup_not_allowed',
  'an anonymous sign-up is refused'
);
select is(
  public.hook_before_user_created(pg_temp.sign_up_event('facebook', 'developer@findsprop.com')) -> 'error' ->> 'message',
  'signup_not_allowed',
  'a provider the guard does not know is refused, even for a reserved address'
);

-- It never raises, whatever it is given
select is(
  public.hook_before_user_created('{}'::jsonb) -> 'error' ->> 'message',
  'signup_not_allowed',
  'an empty event is refused'
);
select is(
  public.hook_before_user_created(null) -> 'error' ->> 'message',
  'signup_not_allowed',
  'a missing event is refused'
);
select is(
  public.hook_before_user_created('{"user": {"email": 5, "app_metadata": "x"}}'::jsonb) -> 'error' ->> 'message',
  'signup_not_allowed',
  'a malformed event is refused'
);

-- Who may call it
select ok(
  has_function_privilege('supabase_auth_admin', 'public.hook_before_user_created(jsonb)', 'execute'),
  'the Auth service can call the guard'
);
select ok(
  not has_function_privilege('anon', 'public.hook_before_user_created(jsonb)', 'execute'),
  'a visitor cannot call the guard'
);
select ok(
  not has_function_privilege('authenticated', 'public.hook_before_user_created(jsonb)', 'execute'),
  'a signed-in user cannot call the guard'
);
select ok(
  not has_function_privilege('service_role', 'public.hook_before_user_created(jsonb)', 'execute'),
  'the service role cannot call the guard'
);
select is_definer('public', 'hook_before_user_created', array['jsonb'], 'the guard runs as its owner');
select ok(
  (select array_to_string(proconfig, ',') like '%search_path=%'
   from pg_proc where oid = 'public.hook_before_user_created(jsonb)'::regprocedure),
  'the guard pins its search_path'
);

select * from finish();
rollback;
